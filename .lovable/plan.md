## Objetivo

Estender o fluxo de troca de titularidade na Hinova para também transferir o **voluntário (consultor)** quando ele mudou na troca, e tornar a confirmação pós-alteração mais robusta com **retry/backoff** na re-consulta — sem mudar o critério primário de sucesso (resposta `Alterado` + `errors:[]`).

Aplicar nos dois caminhos canônicos:
- `supabase/functions/sga-hinova-sync/index.ts` (função interna `transferir_vinculo_veiculo`)
- `supabase/functions/oneoff-sga-liberar-placa-troca/index.ts`

E no client compartilhado:
- `supabase/functions/_shared/hinova-client.ts` (helper de busca/payload de alteração — `codigo_voluntario` já é aceito pelo `/alterar/veiculo`, só precisa ser propagado).

---

## 1. Resolver o voluntário esperado da troca

Para cada troca efetivada (linha de `solicitacoes_troca_titularidade`):

1. Localizar o **vendedor do novo titular** seguindo a cadeia já usada no `sga-hinova-sync` para cadastro:
   - `solicitacoes_troca_titularidade.cotacao_id` → `contratos` ativo gerado para o `novo_associado_id` → `contratos.vendedor_id` → `profiles.codigo_sga_voluntario`.
   - Fallback: contrato ativo mais recente do `novo_associado_id` que aponte para esse veículo.
2. `codigoVoluntarioNovo = parseInt(profiles.codigo_sga_voluntario)`.
3. Se o novo titular não tiver vendedor com `codigo_sga_voluntario` válido, **não bloqueia** a troca — apenas loga `warning: voluntario_nao_resolvido` e segue só com `codigo_associado` no payload (comportamento atual).

## 2. Capturar voluntário atual na busca da Hinova

Hoje a etapa `hinova_busca` extrai apenas `codigo_veiculo` e `codigo_associado_atual`. Estender para:

- Ler também `codigo_voluntario` (ou `codigo_voluntario_atual`/equivalente) do payload retornado por `buscarVeiculoPorPlaca`/`buscarVeiculoPorChassi`. Tratar como número (0 se ausente).
- Incluir `codigo_voluntario_atual` no log do step `hinova_busca` (e equivalente no oneoff).

## 3. Decidir envio do `codigo_voluntario`

Após a busca:

- Se `codigoVoluntarioNovo` resolvido **e** diferente de `codigo_voluntario_atual` → incluir `codigo_voluntario: codigoVoluntarioNovo` no payload de `/alterar/veiculo`.
- Se forem iguais (ou novo não resolvido) → **omitir** o campo (comportamento idêntico ao atual nessa dimensão).

Atualizar a checagem de **idempotência** (passo "já está com o novo titular?") para considerar tanto `codigo_associado` quanto `codigo_voluntario`: só pula a chamada de alteração se **ambos** já batem com o esperado. Se associado bate mas voluntário diverge, segue com alteração enviando só `codigo_voluntario` (+ `codigo_veiculo`).

## 4. Reportar voluntário nos steps

- Step `hinova_busca`: acrescentar `codigo_voluntario_atual`.
- Step `alterar_veiculo`: acrescentar `codigo_voluntario_antigo`, `codigo_voluntario_novo`, `enviou_voluntario` (boolean), espelhando o que já é feito hoje para o associado.
- Auditoria (`insertAuditLog.dados_novos`) e `logSync` ganham os mesmos campos.

## 5. Re-consulta com retry/backoff (Opção 1)

Substituir a re-consulta única atual por loop:

```text
para tentativa de 1 a 3:
  recheck = buscarVeiculoPorPlaca(placa)  // ou por chassi quando for o caso
  ok_assoc = recheck.codigo_associado == codAssocNovo
  ok_volun = (!enviou_voluntario) || recheck.codigo_voluntario == codigoVoluntarioNovo
  confirmado = ok_assoc && ok_volun
  se confirmado: break
  se tentativa < 3: aguardar 2.5s (jitter 2000–3000ms)
```

Logar cada tentativa em um step próprio `reconsultar_placa` com `tentativa`, `codigo_associado_atual`, `codigo_voluntario_atual`, `confirmado`.

Se as 3 tentativas falharem:
- Não tratar como erro funcional. Marcar `confirmado: false`.
- Adicionar `confirmacao_pendente: true` no resultado.
- Log final extra `confirmacao_pendente_pos_alteracao` com `motivo: 'Hinova aceitou /alterar/veiculo mas índice ainda não propagou (cache observado no caso Bruna)'`.
- Reenfileirar a fila normalmente (já faz hoje) — próximo ciclo do cron valida.

O critério primário de sucesso permanece sendo `ra.ok` (resposta `Alterado` + `errors:[]`) — retry serve apenas para enriquecer o relatório.

## 6. Não mudar

- `transferir_agregados` continua atrás da flag `sga_alterar_veiculo_enviar_agregados` (omitido por default).
- Nenhuma mudança em `sga_sync_queue`, triggers ou tabelas.
- `oneoff-sga-inativar-veiculo-remoto` segue marcada como deprecada (410).

---

## Detalhes técnicos

### Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/hinova-client.ts` | `alterarVeiculoHinova` aceita `codigo_voluntario` opcional (apenas garantir que o número passa pelo payload sem coerção). Helper utilitário `extractCodigoVoluntario(found)` que normaliza nomes alternativos vindos da Hinova. |
| `supabase/functions/sga-hinova-sync/index.ts` | Função `transferir_vinculo_veiculo`: resolver `codigoVoluntarioNovo` a partir da troca, capturar atual no recheck, decidir envio, loop de re-consulta com backoff, logs e auditoria estendidos. |
| `supabase/functions/oneoff-sga-liberar-placa-troca/index.ts` | Mesmo conjunto de mudanças, replicando steps + resposta JSON com `codigo_voluntario_antigo`, `codigo_voluntario_novo`, `enviou_voluntario`, `confirmacao_pendente`. |

### Resolução do voluntário (pseudo-código)

```ts
async function resolverVoluntarioNovoTitular(supabase, troca): Promise<number | null> {
  // 1) Cotação vinculada à troca → contrato gerado → vendedor
  if (troca.cotacao_id) {
    const { data: c } = await supabase.from('contratos')
      .select('vendedor_id, profiles:vendedor_id(codigo_sga_voluntario)')
      .eq('cotacao_id', troca.cotacao_id)
      .eq('associado_id', troca.novo_associado_id)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    const v = parseInt(c?.profiles?.codigo_sga_voluntario || '', 10);
    if (Number.isFinite(v) && v > 0) return v;
  }
  // 2) Fallback: contrato ativo mais recente do novo associado
  // (mesma query sem o filtro cotacao_id)
  return null;
}
```

### Backoff

Função utilitária local: `sleepJitter(min=2000, max=3000)` usando `setTimeout` em `Promise`.

---

## Plano de validação manual (sem alterar nada em produção até passar)

1. **Caso Bruna (RFL7J00)** — re-rodar `oneoff-sga-liberar-placa-troca` com a nova versão. Esperado:
   - `hinova_busca`: traz `codigo_voluntario_atual` (do Douglas).
   - `alterar_veiculo`: payload inclui `codigo_voluntario` da Bruna se diferente.
   - `reconsultar_placa`: pelo menos uma das 3 tentativas marca `confirmado: true`. Se nenhuma confirmar, resposta vem com `confirmacao_pendente: true` e o log explicando o cache da Hinova.
2. **Teste de agregado** — segue a sequência já planejada (intocada).
3. Só após esses dois passos: marcar `oneoff-sga-inativar-veiculo-remoto` como 410 (já feito) e reenfileirar as `falha_permanente` do padrão.

## Riscos

- Nome do campo retornado pela Hinova para o voluntário pode variar (`codigo_voluntario` vs `codigo_volutario_atual` etc.) — o helper `extractCodigoVoluntario` cobre as variantes conhecidas e cai em `0` quando ausente, sem quebrar o fluxo.
- Se o novo titular não tiver vendedor cadastrado, voluntário não é enviado — coerente com a regra "se igual, omitir" e evita propagar valores inválidos.

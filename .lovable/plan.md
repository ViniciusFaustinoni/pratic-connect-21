## Diagnóstico — caso ALEXANDRE GUTTI (KRN9E64 / CPF 134.915.737-69 / codigo_hinova 21020)

Confirmei nos logs e nos `sga_situacao_check` por que o gate mostra "OK" mesmo o associado tendo boletos em aberto no SGA.

### O que a verificação enxergou

O check mais recente (19/05 16:47 / 16:29 / 16:19) trouxe sempre o mesmo payload da edge `sga-listar-boletos-associado`:

```json
{
  "encontrado": true,
  "codigo_associado": 21020,
  "veiculos": [
    { "placa": "KRN9E64", "codigo_veiculo": 24662,
      "boletos_abertos": [], "situacao_financeira": null }
  ],
  "tem_debito": false
}
```

Logs do Hinova confirmam:

- `GET /buscar/situacao-financeira-veiculo/24662` → **null** (veículo novo, ainda sem situação calculada).
- `[sga-listar-boletos-associado] situacao_financeira indisponivel para todos os veiculos … placas: ["KRN9E64"]`.

### Por que isso é falso-OK

`sga-listar-boletos-associado` enumera os veículos chamando `GET /associado/buscar/{cpf}/cpf` no Hinova. **Para esse CPF, o Hinova devolveu apenas o veículo da cotação atual (KRN9E64 / código 24662 — o que acabou de ser sincronizado)** — provavelmente porque o endpoint retorna só os veículos da matrícula "viva" mais recente. Os boletos vencidos do Alexandre estão em **outros veículos/matrículas anteriores** do mesmo CPF, que esse endpoint não devolve. Resultado:

- Vetor de boletos = vazio → `qtd_boletos_abertos = 0`.
- `situacao_financeira` do único veículo enumerado = `null` (KRN9E64 é novo, nunca teve cobrança).
- O gate decide `tem_debito=false` → libera o Cadastro como "Situação financeira OK".

Some-se a isso: o caminho atual **trata `situacao_financeira=null` em todos os veículos como ADIMPLENTE por omissão**. Mesmo se a enumeração estivesse completa, a ausência total de sinal SGA estaria sendo lida como "tudo certo", o que vai contra a regra canônica do `mem://logic/operations/sga-inadimplencia-veiculo-canonica` ("só boletos não basta — flag INADIMPLENTE no veículo é canônica").

---

## Plano de correção (focado, sem mudar UI fora do gate)

### Parte 1 — Saneamento do caso Alexandre (imediato)

- Invalidar o `sga_situacao_check` mais recente do contrato `ee5f5aa3-…` inserindo um registro `origem_resultado='inconclusivo'` com `tem_debito=true`, `motivo='enumeracao_incompleta_sga'` e payload de auditoria explicando que o gate detectou apenas 1 veículo e nenhum sinal `situacao_financeira`.
- Histórico em `associados_historico` registrando: "Gate SGA tratado como inconclusivo. Cadastro só pode prosseguir após verificação manual dos boletos do CPF 134.915.737-69 no painel SGA ou bypass auditado por Diretor."
- Resultado UI esperado: o `SituacaoFinanceiraGate` passa a renderizar o card de bloqueio (vermelho) ao invés do verde, exigindo "Consultar SGA novamente" ou "Ignorar e Prosseguir" (com motivo).

### Parte 2 — Correção sistêmica do gate

**2a. Edge `sga-listar-boletos-associado`** — endurecer a enumeração de veículos para cobrir o CPF inteiro:

1. Após `buscarAssociadoComVeiculosPorCpf`, complementar a lista com:
   - Veículos espelhados localmente em `public.veiculos` para o mesmo `associado_id` ou mesmo `cliente_cpf` (incluindo `status` cancelado/inadimplente).
   - Resultado da tabela de auditoria `sga_situacao_check.payload` mais recente para o CPF, juntando todos os `codigo_veiculo` já vistos.
   - De-duplicar por `codigo_veiculo`.
2. Rodar `listarBoletosVeiculo` + `buscarSituacaoFinanceiraVeiculo` em cada `codigo_veiculo` agregado, não só nos retornados pelo `/associado/buscar/cpf`.
3. Marcar veículos de origem "local-only" com flag `origem_enumeracao: 'local'` no payload (auditoria).

**2b. Edge `verificar-situacao-financeira-cadastro`** — endurecer a classificação:

- Substituir a regra "tem_debito = qtd>0 || placasInadimplentes>0" por uma classificação em 3 estados:
  - `OK` → existe pelo menos 1 veículo retornado pelo SGA E todos com `situacao_financeira='ADIMPLENTE'` E `qtd_boletos_vencidos=0`.
  - `INADIMPLENTE` → qualquer boleto vencido OU qualquer `situacao_financeira='INADIMPLENTE'`.
  - `INCONCLUSIVO` (novo `origem_resultado='inconclusivo'`) → SGA respondeu mas TODOS os veículos vieram com `situacao_financeira=null` E nenhum boleto vencido. Hoje isso é lido como OK; passará a bloquear o gate com mensagem "Sinal SGA insuficiente, verifique manualmente ou faça bypass auditado".
- `liberado=true` apenas em `OK` e `bypass`/`transitorio`/`associado_inexistente_sga` (mantidos).

**2c. Componente `SituacaoFinanceiraGate.tsx`** — adicionar branch para `origem_resultado='inconclusivo'`:

- Card amarelo (não vermelho, porque não temos certeza de débito), com texto "Verificação financeira inconclusiva — o SGA retornou veículo sem sinal de situação financeira. Confira boletos manualmente no painel SGA antes de aprovar." Botões: "Consultar SGA novamente" + "Ignorar e Prosseguir" (bypass auditado).
- Continua bloqueando avanço do Cadastro (mesmo comportamento do estado inadimplente, mas visualmente diferente).

### Parte 3 — Auditoria de outros casos (somente consulta, sem alteração)

Listar contratos em `aguardando_aprovacao_cadastro` cujo último `sga_situacao_check` tenha `origem_resultado='sga'`, `tem_debito=false`, `qtd_boletos_abertos=0` E todos os `payload.veiculos[*].situacao_financeira` null. Esses casos provavelmente foram falsamente liberados pelo mesmo bug — relatório no chat para o usuário decidir.

---

## Detalhes técnicos

- Arquivos tocados: `supabase/functions/sga-listar-boletos-associado/index.ts`, `supabase/functions/verificar-situacao-financeira-cadastro/index.ts`, `src/components/cadastro/SituacaoFinanceiraGate.tsx`. Sem mudança de schema.
- Saneamento do Alexandre via 1 INSERT em `sga_situacao_check` + 1 INSERT em `associados_historico` (sem migration de schema).
- Compatível com o cache de 10 min: o INSERT do saneamento será o registro mais recente, então o gate da UI passa a refletir imediatamente.
- Nova memória `mem://logic/operations/gate-financeiro-cadastro-inconclusivo` documentando que `situacao_financeira=null` em TODOS os veículos = inconclusivo (não OK).

---

## Checklist de execução

1. Inserir registro de saneamento `inconclusivo` para o contrato `ee5f5aa3-…` + histórico.
2. Editar `sga-listar-boletos-associado/index.ts` para enumerar também por `veiculos` local + `sga_situacao_check.payload` históricos.
3. Editar `verificar-situacao-financeira-cadastro/index.ts` para classificar 3 estados (OK / INADIMPLENTE / INCONCLUSIVO).
4. Editar `SituacaoFinanceiraGate.tsx` adicionando branch `inconclusivo` (card amarelo bloqueador + bypass).
5. Rodar consulta de auditoria pós-deploy listando contratos potencialmente afetados pelo mesmo bug.
6. Criar memória `mem://logic/operations/gate-financeiro-cadastro-inconclusivo` e referenciá-la no índice.

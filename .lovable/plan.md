## Diagnóstico

**Associado:** TOVAR RODRIGUES LIMA — placa **TCU6B84** — etapa `veiculo`.

**Erro:** `[cadastrarVeiculo] Auth recusada (http=401)`.

**É exatamente o mesmo bug que corrigimos para o VINICIUS**, só que em outra função do mesmo arquivo. Na correção anterior, eu refatorei apenas `buscarVeiculoPorPlaca` para usar `hinovaFetch` (wrapper com retry + reauth automático em 401/403). Mas **deixei todas as outras funções de cadastro/alteração ainda chamando `fetch` direto com um token possivelmente já invalidado** pela Hinova. Foi correção parcial — agora bateu em `cadastrarVeiculoHinova`.

### Sequência exata da falha (TOVAR)

```
1. autenticar                  → token A
2. buscar_associado_cpf        → ok com token A
3. cadastrar_associado         → ok, MAS Hinova invalida token A e devolve token B internamente
4. cadastrar_veiculo           → ainda usa token A em cache local da função → 401  ❌
```

### Causa raiz definitiva

A Hinova é **stateful**: cada `/usuario/autenticar` invalida tokens emitidos anteriormente. Várias funções em `_shared/hinova-client.ts` ainda recebem `session: HinovaSession` por parâmetro e chamam `fetch` direto com `authHeaders(s)` — sem o wrapper `hinovaFetch` que detecta 401/403, invalida o cache, reautentica e refaz a chamada uma vez.

**Funções vulneráveis identificadas** (todas usam `fetch` direto + `authHeaders(s)`):

| Linha | Função | Endpoint |
|---|---|---|
| 442 / 461 | `buscarVeiculoPorPlaca` | já corrigida ✅ |
| 484 | `buscarSituacaoFinanceiraVeiculo` | `GET /buscar/situacao-financeira-veiculo/:codigo` |
| 567 | `listarBoletosVeiculoJanela` | `POST /listar/boleto-associado-veiculo` |
| 758 | `buscarAssociadoPorCpf` | `GET /associado/buscar/:cpf/cpf` |
| 964 | `cadastrarAssociadoHinova` | `POST /associado/cadastrar` |
| 999 | `cadastrarVeiculoHinova` | `POST /veiculo/cadastrar` ← **erro do TOVAR** |
| 1039 | `alterarSituacaoVeiculoHinova` | `POST /veiculo/alterar/situacao` |
| 1088 | `cadastrarFotosVeiculoHinova` | `POST /veiculo/foto/cadastrar` |
| 1127 | `buscarVeiculoPorChassi` | `GET /veiculo/buscar/:chassi/chassi` |

Qualquer uma destas pode disparar 401 quando outra chamada concorrente (no mesmo loop) reautenticar e invalidar o token capturado.

## Correção (na raiz, definitiva)

Refatorar **todas as 8 funções vulneráveis** para usar `hinovaFetch(supabase, buildRequest, ctx)`. Elas passam a receber `supabase` (em vez de `session`) e ganham automaticamente:
- retry único em 401/403 com `force: true` na sessão
- tratamento uniforme de janela horária / 5xx
- mesma assinatura de telemetria

### Mudanças em `supabase/functions/_shared/hinova-client.ts`

Para cada função acima, trocar o padrão atual:

```ts
// ❌ ANTES
export async function cadastrarVeiculoHinova(s: HinovaSession, payload) {
  const r = await fetch(`${s.apiUrl}/veiculo/cadastrar`, {
    method: 'POST', headers: authHeaders(s), body: JSON.stringify(payload),
  });
  ...
}

// ✅ DEPOIS
export async function cadastrarVeiculoHinova(supabase: any, payload) {
  const session0 = await getHinovaSession(supabase);
  const { response: r, bodyText: txt } = await hinovaFetch(
    supabase,
    (token) => ({
      url: `${session0.apiUrl}/veiculo/cadastrar`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      },
    }),
    'cadastrarVeiculo',
  );
  ...
}
```

### Mudanças nos chamadores

Atualizar a assinatura nas seguintes edge functions para passar `supabase` em vez de `session`:

- `supabase/functions/sga-hinova-sync/index.ts` — chama `cadastrarAssociadoHinova`, `cadastrarVeiculoHinova`, `alterarSituacaoVeiculoHinova`, `cadastrarFotosVeiculoHinova`, `buscarSituacaoFinanceiraVeiculo`, `buscarAssociadoPorCpf`, `buscarVeiculoPorChassi`
- `supabase/functions/sga-buscar-associado-completo/index.ts`
- `supabase/functions/sga-sync-financeiro-veiculo/index.ts`
- `supabase/functions/sga-testar-boletos-veiculo/index.ts`
- `supabase/functions/sga-mapear-codigos-veiculos/index.ts`
- `supabase/functions/sga-verificar-veiculo/index.ts`
- `supabase/functions/sga-atualizar-placa/index.ts`
- `supabase/functions/sga-reconciliar-codigo-veiculo/index.ts`
- `supabase/functions/hinova-diag-placa/index.ts`
- demais que importem essas funções (vou auditar com `rg` no momento da implementação)

### Reprocessar TOVAR / TCU6B84

Migration que reseta `status_sga='pendente'` e remove o item de erro da `sga_sync_queue` para o veículo do TOVAR, e dispara `sga-hinova-sync` manualmente após o deploy para validar que funciona ponta a ponta.

### Validação

1. Logs do TOVAR: `cadastrar_associado success → cadastrar_veiculo success → enviar_fotos success → sync_completo success`.
2. Rodar 5–10 veículos da fila para garantir que não regrediu.
3. Adicionar memória de projeto (`mem://...`) com a regra **"toda chamada autenticada Hinova deve usar `hinovaFetch`"** para evitar que esse padrão errado volte em código novo.

### Por que dessa vez fica 100%

Antes corrigi caso a caso conforme apareciam erros — abordagem reativa. Agora vamos refatorar **todas** as funções autenticadas do `hinova-client.ts` de uma vez, padronizando no único caminho seguro (`hinovaFetch`). Qualquer função futura que esquecer o wrapper vai falhar imediatamente em desenvolvimento porque não vai compilar (mudamos a assinatura: passa-se `supabase`, não mais `session`).
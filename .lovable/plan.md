

## Corrigir mapeamento de códigos Hinova: alinhar headers de autorização

### Causa raiz definitiva

O cliente compartilhado `_shared/hinova-client.ts` envia um **header de autorização diferente** do que `sga-hinova-sync` (o único caminho comprovadamente funcional) usa. Por isso 100% das 9.618 placas voltam "não encontradas", mesmo com a autenticação OK.

| Função | `Authorization` | Outros headers |
|---|---|---|
| `sga-hinova-sync` (funciona) | `Bearer ${token_usuario}` (token retornado pelo `/usuario/autenticar`) | — |
| `_shared/hinova-client.ts` (não encontra nada) | `Bearer ${creds.token}` (token fixo de aplicação) | `token_usuario: ${tokenUsuario}` (header custom) |

A Hinova SGA v2 espera o **token de sessão** no `Authorization`. Quando recebe o token de aplicação, devolve resposta vazia/200 nas rotas GET de consulta, sem 401 explícito — exatamente o sintoma observado: `boletos_importados: 0`, `situacao_financeira: null`, mapeamento de placa retornando "sem histórico" para todo mundo.

Outro ganho: **9.618/9.618 dos veículos pendentes têm `associados.codigo_hinova` preenchido**. Logo, sequer precisamos depender da busca por placa — basta listar os boletos do associado (endpoint que JÁ FUNCIONA quando os headers estão corretos) para descobrir o `codigo_veiculo` Hinova ali presente, ou usar a busca por placa agora corrigida.

### Correção

**1. Alinhar `authHeaders` no `_shared/hinova-client.ts`**

Trocar:
```ts
{ Authorization: `Bearer ${s.token}`, token_usuario: s.tokenUsuario }
```
por:
```ts
{ Authorization: `Bearer ${s.tokenUsuario}` }
```

Isso corrige automaticamente as 3 funções que dependem do shared:
- `buscarVeiculoPorPlaca` (mapeamento)
- `buscarSituacaoFinanceiraVeiculo` (sync financeira)
- `listarBoletosVeiculo` (sync financeira)

**2. Adicionar telemetria mínima no `buscarVeiculoPorPlaca`**

Logar `r1.status` + 200 chars do body em **toda** chamada (não só erro), gravado em `sga_sync_logs` com `action='buscar_veiculo_placa'`. Sem isso, o próximo bug volta a passar despercebido. Limitar para 1 log a cada 10 placas processadas para não inundar.

**3. Re-tentar mapeamento do lote já processado erroneamente**

Os 9.618 jobs marcados como `sem_historico_hinova` foram falsos negativos causados pelo bug de header. Migration que **reseta** `sga_sync_financeiro_jobs` onde `tipo='mapear_codigo' AND status='sem_historico_hinova'` (qualquer data, não só os 30min anteriores), liberando todos para reprocessamento.

**4. Validar com 5 placas reais antes de rodar tudo**

Após o fix, executar `sga-mapear-codigos-veiculos` com `batch_size=5` e conferir que pelo menos 4 das 5 voltam mapeadas (esses associados têm `codigo_hinova` válido — placas QNA4J27, LQW4H42, KXK2B80, QUD0D43, RJR2I98 devem retornar). Se ainda voltar 0/5, abrir log `buscar_veiculo_placa` para ver resposta crua.

**5. Rodar mapeamento em massa**

Com o critério acima atendido, processar os 9.618 em lotes de 100 (delay 250ms) — ~25 minutos.

### Critérios de aceitação

1. `_shared/hinova-client.ts` envia `Authorization: Bearer ${tokenUsuario}` (sem header `token_usuario` separado).
2. `sga_sync_logs` recebe `action='buscar_veiculo_placa'` amostral em cada batch.
3. Migration zera os 9.618 jobs `sem_historico_hinova` para reprocesso.
4. Teste com 5 placas conhecidas retorna ≥4 mapeadas.
5. Rodada completa: `restantes` cai de 9.618 para próximo de 0 (excluindo placas que de fato não existem na Hinova).
6. Sync financeira por veículo passa a importar boletos > 0 e `situacao_financeira` deixa de ser `null` para associados ativos.

### Fora de escopo

- Refatorar `sga-hinova-sync` para usar o shared client (separado).
- Mexer no `cron-sga-sync-financeiro-diario` (herda a correção).
- Trocar credenciais (estão corretas).


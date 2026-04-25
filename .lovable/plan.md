## Diagnóstico

**Cobranças (tabela `cobrancas`)** — sem duplicidade real:
- 141.512 registros, todos com `nosso_numero` único
- 217 "duplicatas" suspeitas inicialmente detectadas eram **falsos positivos**: associados com 2+ veículos no mesmo vencimento/valor (ex.: associado `035e201b…` com Gol e Prisma, ambos com mensalidade R$ 278,07 vencendo 20/08/2025)
- Índice único parcial `cobrancas_sga_logica_uniq (veiculo_id, data_vencimento, valor, tipo)` está protegendo corretamente — zero violações

**Jobs (tabela `sga_sync_financeiro_jobs`)** — duplicidade real, **1.648 jobs excedentes** em 1.646 veículos:
- 1.060 grupos com `concluido` + `erro` (mesmo veículo enfileirado 2× e processado 2×)
- 573 grupos com múltiplos `concluido`
- 10 grupos com múltiplos `erro`
- 3 grupos incluindo `pendente_retry`

### Causa raiz

O `sga-backfill-financeiro` (rota `enfileirar`) só considera bloqueado quando há job em `pendente | pendente_retry | executando`. Re-execuções do backfill criam novos jobs para veículos já processados (concluídos ou com erro).

```ts
// supabase/functions/sga-backfill-financeiro/index.ts:256
.in('status', ['pendente', 'pendente_retry', 'executando']);  // ❌ ignora concluido/erro
```

**Impacto**: nenhuma duplicidade de cobrança chegou no banco (o índice `cobrancas_sga_logica_uniq` blindou), mas a fila de jobs está poluída — o que distorce métricas (% de progresso, contagem de erros) e gera chamadas redundantes à Hinova.

## Plano de correção

### 1. Limpeza de dados (migração — `UPDATE`)

Cancelar jobs duplicados mantendo apenas o "melhor" por (veículo, tipo):
- Prioridade: `concluido` > `erro` > `pendente_retry` (na prática só sobram `concluido`/`erro`)
- Se houver múltiplos no melhor status, manter o mais recente (`updated_at DESC`)
- Marcar os demais como `cancelado` com `ultimo_erro = 'duplicata_dedupe_$timestamp'` para auditoria
- Estimativa: ~1.648 jobs serão cancelados

### 2. Index único de proteção (migração — schema)

Criar índice único parcial bloqueando jobs ativos duplicados:
```sql
CREATE UNIQUE INDEX sga_sync_financeiro_jobs_ativo_uniq
  ON sga_sync_financeiro_jobs (veiculo_id, tipo)
  WHERE status IN ('pendente','pendente_retry','executando');
```
Garante que nunca mais haverá 2 jobs ativos para o mesmo veículo, mesmo se o backfill rodar concorrentemente.

### 3. Backfill idempotente (`sga-backfill-financeiro/index.ts`)

Trocar a verificação de bloqueio para considerar **qualquer job não cancelado** dentro de uma janela (ex.: últimas 24h) — assim, re-executar o backfill no mesmo dia não recria jobs:

```ts
.in('status', ['pendente','pendente_retry','executando','concluido','erro'])
.gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString())
```

Adicionar `onConflict` no insert para falhar silenciosamente em corrida:
```ts
.upsert(novos, { onConflict: 'veiculo_id,tipo', ignoreDuplicates: true })
```
(funciona em conjunto com o índice único parcial).

### 4. Cron diário (`cron-sga-sync-financeiro-diario/index.ts`)

Verificar se enfileira jobs e aplicar a mesma proteção (idempotência por janela + upsert). Já é o padrão — só validar.

### 5. Validação pós-fix

Rodar query de auditoria:
```sql
SELECT COUNT(*) FROM (
  SELECT veiculo_id, tipo FROM sga_sync_financeiro_jobs
  WHERE status NOT IN ('cancelado')
  GROUP BY veiculo_id, tipo HAVING COUNT(*) > 1
) t;  -- deve retornar 0
```

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Nova migração SQL (schema) | Cria índice único parcial |
| Nova migração SQL (data via insert tool) | Cancela 1.648 duplicatas existentes |
| `supabase/functions/sga-backfill-financeiro/index.ts` | Bloqueio idempotente + upsert |
| `supabase/functions/cron-sga-sync-financeiro-diario/index.ts` | Validação/ajuste defensivo |

### Fora de escopo

- Cobranças: nenhuma ação necessária (zero duplicatas reais)
- Reprocessar cobranças importadas (já estão íntegras)
# Acelerar drenagem do financeiro Hinova

## Diagnóstico do gargalo atual

A drenagem está lenta porque cada veículo é processado **sequencialmente, um por um**, dentro de cada batch:

- **Loop sequencial**: o orquestrador `sga-backfill-financeiro` faz `for (job of jobs) { await invoke(...) ; await sleep(150ms) }` → cada veículo espera o anterior terminar
- **Tempo típico por veículo**: ~1,5–3s (chamada à API Hinova) + 150ms de delay = ~2s
- **Throughput real**: ~30 veículos/min por execução de batch
- **Cron de 5 em 5 min** com batches de 50 → no melhor caso ~600/h, mas na prática a UI mostra **0 jobs/min** porque o loop fica preso esperando respostas
- **Métrica "Velocidade 0 jobs/min"** confirma: a janela de medição (60s) raramente captura conclusões

## O que muda

### 1. Paralelismo dentro do batch (impacto principal)

No `sga-backfill-financeiro/index.ts`, substituir o loop `for` sequencial por processamento em **chunks paralelos** com `Promise.allSettled`:

- Aceitar novo parâmetro `concurrency` (default `8`, máx `15`)
- Dividir os 50 jobs em chunks de 8 e disparar `invoke()` em paralelo dentro de cada chunk
- Manter o circuit breaker (5 falhas auth seguidas → aborta) verificando o resultado agregado de cada chunk
- Reduzir `delayMs` default de 150ms → 50ms (entre chunks, não entre jobs)
- Aumentar `batchSize` máximo de 100 → **200**

**Ganho estimado**: ~6–8x mais rápido → ~200–250 veículos/min por execução

### 2. Cron mais agressivo

Trocar o schedule do cron `sga-sync-financeiro-drenagem-5min` de `*/5` (a cada 5 min) para `*/2` (a cada 2 min) durante o horário de operação. Isso garante que, se um batch terminar antes do tempo, o próximo já dispare.

### 3. Frontend — usar valores agressivos por default

No `SgaBackfillFinanceiroDialog.tsx`, atualizar as chamadas de "Iniciar drenagem" e "Forçar processamento" para enviar:
```
{ acao: 'processar', batch_size: 100, delay_ms: 50, concurrency: 10 }
```

### 4. KPI "Velocidade" — janela maior para capturar progresso real

A janela atual de 60s (5 amostras de 12s) zera quando não há atualização entre dois polls. Aumentar a janela para **3 minutos** (15 amostras) e calcular a taxa instantânea com base em qualquer delta > 0, não apenas no último intervalo.

## Riscos e mitigações

- **Hinova pode aplicar rate limit**: começamos com `concurrency=8` (conservador). Se aparecer pico de erros 429/restrição, o circuit breaker já existente reagenda para a próxima janela.
- **Edge function timeout**: Supabase edge functions têm limite de ~150s. Com batch=100 e concurrency=10, cada batch leva ~20-30s — bem dentro do limite.
- **Custo de invocações concorrentes**: cada `supabase.functions.invoke` para `sga-sync-financeiro-veiculo` é uma execução separada. Com concorrência 10 e cron a cada 2 min, ainda fica longe dos limites do plano.

## Arquivos alterados

- `supabase/functions/sga-backfill-financeiro/index.ts` — paralelismo via chunks + `Promise.allSettled`, novos defaults
- `src/components/cobranca/SgaBackfillFinanceiroDialog.tsx` — passa `concurrency`, `batch_size` 100, `delay_ms` 50; janela de KPI de 60s → 180s
- Migration SQL — atualiza schedule do cron `sga-sync-financeiro-drenagem-5min` para `*/2 9-23,0-1 * * *`

## Validação após deploy

1. Iniciar drenagem pelo modal
2. Confirmar via `sga_runtime_state.backfill_processados_total` que o número sobe rapidamente (esperado: +100/min)
3. Confirmar KPI "Velocidade" no modal mostra valor > 0
4. Verificar `sga_sync_financeiro_jobs` (status='erro') não dispara — se disparar e for 429/restrição, reduzir `concurrency` para 5

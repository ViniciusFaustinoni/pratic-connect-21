
## Problema

O botão "Forçar Sync" processa apenas alguns lotes e para. Hoje há **208.845 jobs pendentes** e somente **64 concluídos**. O progresso fica em ~0% e parece travado.

### Causas raiz

1. **Timeout síncrono no Edge Function.** `cron-sga-sync-financeiro-diario` (chamado pelo botão "Forçar Sync") roda 80 ciclos × 50 jobs com `await sleep(150ms)` — projeto de ~13 min — dentro do request HTTP. O timeout do edge function (~150s) mata o loop no meio do caminho.
2. **Sem `EdgeRuntime.waitUntil()`.** Quando o cliente fecha a conexão ou o timeout dispara, o trabalho é abortado.
3. **Drenagem insuficiente.** O único cron de drenagem (`sga-sync-financeiro-drenagem-2h`) roda 7×/dia e sofre do mesmo timeout — nunca esgota 208k jobs.
4. **Progresso ambíguo na UI.** A barra mostra `concluídos / total` (64/209.197 ≈ 0%) sem distinguir "fila completa" de "ritmo de processamento atual", e sem indicar se há um job em background ativo.

## Solução

### 1) Disparo assíncrono real (background)

Refatorar `cron-sga-sync-financeiro-diario` para retornar **202 Accepted** imediatamente e processar em background com `EdgeRuntime.waitUntil()`. O loop continua mesmo após o cliente desconectar.

Adicionar idempotência: a tabela `sga_runtime_state` já tem `backfill_financeiro_ativo` + TTL. Se já houver execução ativa (TTL não expirado), o novo disparo apenas retorna "já em execução" — evita drenagem dupla.

Persistir contadores incrementais por execução em uma nova coluna (ou tabela leve) para que a UI possa ler progresso em tempo real:
- `backfill_lote_atual`, `backfill_processados_total`, `backfill_ok_total`, `backfill_fail_total`, `backfill_retry_total`, `backfill_ultimo_heartbeat`.

### 2) Drenagem contínua via pg_cron a cada 5 minutos

Trocar o cron `sga-sync-financeiro-drenagem-2h` (7×/dia) por **`sga-sync-financeiro-drenagem-5min`** (288×/dia, dentro da janela 06h–22h BRT). Cada execução:
- Verifica se já há backfill ativo via `sga_runtime_state` (TTL); se sim, sai cedo.
- Caso contrário, dispara processamento em background até esgotar (até MAX_CICLOS) e atualiza heartbeat.

Isso garante que mesmo sem clique manual a fila drena sozinha em segundo plano até zerar.

### 3) Cap defensivo por execução em background

Manter o ciclo dentro de uma única execução com teto seguro (ex.: 60 min máximo de wall-clock e 200 ciclos × 50 jobs = 10.000 jobs/execução). Se o teto for atingido, libera o flag e a próxima execução do cron de 5 min retoma de onde parou.

### 4) UI com progresso preciso e ao vivo

Em `SgaBackfillFinanceiroDialog.tsx`:
- **Botão "Forçar Sync"** muda para "Iniciar drenagem em background". Mostra estado: `idle` / `executando` / `concluído` baseado em `sga_runtime_state.backfill_financeiro_ativo` + heartbeat (<2 min = vivo).
- **Indicador de heartbeat:** mostra "Última atividade: há X seg" lendo `backfill_ultimo_heartbeat`.
- **Velocidade de drenagem:** calcula jobs/min a partir de `(processados_atual − processados_há_30s) / 0.5min`.
- **ETA:** `pendentes / velocidade`.
- **Barra de progresso:** mantém `(concluído + sem_histórico + cancelado) / total` mas adiciona texto explicativo "X de Y veículos sincronizados".
- **Auto-refresh** mantido a cada 5s, sem necessidade de manter o diálogo aberto (o backend continua sozinho).

### 5) Botão "Parar drenagem" (cancelamento gracioso)

Adicionar ação `parar_drenagem` em `sga-backfill-financeiro` que limpa `backfill_financeiro_ativo` e seta um flag `backfill_cancelar_solicitado`. O loop em background lê esse flag entre lotes e encerra graciosamente.

## Comportamento esperado após a correção

- Usuário clica em "Iniciar drenagem". Resposta volta em <1s com "drenagem iniciada em background".
- Mesmo fechando o diálogo / saindo da página, o backend continua processando.
- O cron de 5 min garante que se a função for finalizada por timeout do runtime (ex.: 60 min), a próxima execução retoma automaticamente.
- A fila de 208.845 jobs drena sozinha em ~10–20 horas considerando ~150ms/job + janela horária Hinova.
- A barra de progresso avança visivelmente a cada 5s.

## Arquivos afetados

**Backend:**
- `supabase/functions/cron-sga-sync-financeiro-diario/index.ts` — refatorar para `EdgeRuntime.waitUntil` + 202 Accepted + heartbeat.
- `supabase/functions/sga-backfill-financeiro/index.ts` — adicionar ações `parar_drenagem` e `status_drenagem`; atualizar `sga_runtime_state` com contadores.
- Nova migração: adicionar colunas `backfill_processados_total`, `backfill_ok_total`, `backfill_fail_total`, `backfill_retry_total`, `backfill_lote_atual`, `backfill_ultimo_heartbeat`, `backfill_cancelar_solicitado` em `sga_runtime_state`.
- Migração: trocar cron `sga-sync-financeiro-drenagem-2h` por `sga-sync-financeiro-drenagem-5min` (`*/5 6-22 * * *` em BRT = `*/5 9-23,0-1 * * *` em UTC, ajustado).

**Frontend:**
- `src/components/cobranca/SgaBackfillFinanceiroDialog.tsx` — usar novo `status_drenagem`; renomear botão; adicionar heartbeat, velocidade, ETA, botão Parar.

## Notas técnicas

- `EdgeRuntime.waitUntil(promise)` é a API nativa do Supabase Edge Runtime para tarefas em background.
- Bloqueio Hinova "Usuário com restrição" continua sendo respeitado — jobs viram `pendente_retry` e a próxima janela retoma.
- Não muda o motor de sync por veículo (`sga-sync-financeiro-veiculo`), apenas o orquestrador.

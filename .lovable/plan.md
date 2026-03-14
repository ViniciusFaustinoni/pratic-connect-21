

# Fix: `sga-hinova-sync` RUNTIME_ERROR (CPU Timeout)

## Problem
The `sga-hinova-sync` edge function is **1629 lines** with multiple sequential HTTP calls (up to 16+ Hinova API requests with retries), heavy DB queries, and string processing. This exceeds Supabase Edge Functions' **2-second CPU time limit**, causing `RUNTIME_ERROR` crashes.

The error shown (`Código associado 29398 inválido`) indicates the function completes its logic but crashes during cleanup, or the CPU budget runs out mid-execution.

## Solution: Background Processing with Immediate Response

Convert to an **async job pattern**: the endpoint returns immediately with a job status, and actual sync runs via `EdgeRuntime.waitUntil()`. The existing `sga_sync_queue` table already tracks progress.

## Changes

### 1. Refactor `supabase/functions/sga-hinova-sync/index.ts`

**Wrap the heavy logic in `EdgeRuntime.waitUntil()`:**

```text
Request received
  ├─ Validate inputs (veiculo_id, associado_id)
  ├─ Check idempotency guard (already synced?)
  ├─ Mark status_sga = 'sincronizando'
  ├─ Return 202 { success: true, status: 'processing' }
  └─ EdgeRuntime.waitUntil(doSync(...))
        ├─ Auth Hinova
        ├─ Search/Create associado
        ├─ Create veículo
        ├─ Upload fotos
        └─ Update DB with results
```

**Key optimizations inside `doSync()`:**
- Reduce CPF search strategies from 7+7=14 attempts to **max 3** (the most likely endpoints)
- Remove `fetchWithRetry` for search endpoints (already single-attempt but still has overhead)
- Limit identity-based log search from 200 to 20 rows
- Wrap entire background in try/catch to always update `status_sga` on failure

### 2. Update frontend callers

Currently `useSGASync.ts` expects a synchronous result. Update to:
- Accept `202` as success (sync started)
- Poll `veiculos.status_sga` via the existing `veiculoQuery` with a shorter refetch interval during sync
- Show "Sincronizando..." state until `status_sga` changes to `ativado_sga` or `erro_sincronizacao`

### 3. Handle the specific "código associado inválido" case

The invalidation logic (lines 1453-1481) correctly resets and queues for retry. The `cron-sga-retry` function will pick it up. The issue is just that the function crashes before returning the response. With background processing, this is resolved.

## Files to modify
1. `supabase/functions/sga-hinova-sync/index.ts` — Refactor to background pattern
2. `src/hooks/useSGASync.ts` — Handle async 202 response, add polling
3. `src/components/cadastro/BotaoAtivarSGA.tsx` — Update UI for async flow (if needed)


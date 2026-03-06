

# Fix: "Enviar para Monitoramento" not working

## Root Cause Analysis

After deep investigation, I found two interconnected issues:

### Issue 1: `instalacoes.status` not syncing for `em_analise`

The trigger `sync_servicos_to_instalacao` maps `servicos.status` → `instalacoes.status`. But `status_instalacao` enum only has: `agendada`, `em_rota`, `em_andamento`, `concluida`, `reagendada`, `cancelada`. It does NOT include `em_analise`.

The CASE fallback keeps the old status (`em_andamento`), so:
- The admin panel (which reads `instalacoes`) still shows the service as active
- The installer may still see it depending on which query is used

### Issue 2: Silent error handling

The `handleEnviarParaMonitoramento` catch block only does `console.error` — no toast is shown to the user on failure, making debugging impossible.

### Current DB state confirms partial update:
- `servicos.decisao_instalador` = `'pendente_monitoramento'` (updated)
- `servicos.status` = `'em_andamento'` (NOT updated to `em_analise`)

This suggests either the `status` update silently fails or the trigger reverts it.

## Solution

### 1. Database Migration
- Add `em_analise` to the `status_instalacao` enum
- Update the `sync_servicos_to_instalacao` trigger to properly handle `em_analise` status mapping

```sql
ALTER TYPE status_instalacao ADD VALUE IF NOT EXISTS 'em_analise';
```

Update the trigger to include `em_analise` in the valid status list for direct mapping.

### 2. Code Fix — Error handling
- Add `toast.error()` in the catch block of `handleEnviarParaMonitoramento` so failures are visible to the user
- Add error checking on the first checklist update call (currently ignores errors)

### 3. Verify servico status update
- Reset the stuck servico `ba744122` status so retesting works cleanly


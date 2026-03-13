

## Problem: Task Not Showing on Installer Screen

### Root Cause (Confirmed via Database)

The RPC function `buscar_tarefa_atual_profissional` is **completely broken**. When called, it throws:

```
ERROR: structure of query does not match function result type
DETAIL: Returned type numeric does not match expected type double precision in column 22.
```

The `servicos.latitude` and `servicos.longitude` columns are type `numeric`, but the function's RETURNS TABLE declares them as `double precision`. This type mismatch causes the RPC to fail on every call, so the installer app **never receives any task data**.

The service record for Marcus Faustinoni exists (`fd8991f8-...`, status `em_rota`, assigned to `68f4857b-...`), but the broken RPC prevents it from appearing.

### Fix

Single SQL migration to recreate the RPC with corrected column types:

- Change `latitude double precision` → `latitude numeric`  
- Change `longitude double precision` → `longitude numeric`

This is a `CREATE OR REPLACE FUNCTION` so it's a safe, non-destructive change.

### Files

- **New**: `supabase/migrations/fix_rpc_tarefa_atual_types.sql` — recreate RPC with correct types

### Expected Result

After deploying, the installer app will immediately start showing assigned tasks. The Realtime subscription already works — this was the only blocker.


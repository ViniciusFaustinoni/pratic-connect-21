

# Fix: Marcus Vinicius SGA sync infinite loop

## Root Cause

The associado was successfully registered in Hinova on Mar 12 with code 29403. At some point, code 29403 was deleted/deactivated in Hinova. Now the system is stuck in a deadlock:

1. **Can't register** — Hinova says "CPF already exists"
2. **Can't search** — Hinova says "Associado not found or unavailable" (406)
3. **Recovery finds stale code 29403** from old identity logs → uses it → Hinova rejects it ("not registered") → invalidates it → **but the invalidation log has NULL `associado_id`**

**The bug**: The `codigosInvalidados` query filters by `associado_id = _aid`, but **8 out of 9 invalidation logs have `associado_id: NULL`** (written before the traceability fix). So on each retry, the filter finds nothing → code 29403 is recovered again via identity logs → fails again → infinite loop since Mar 12.

```text
Timeline:
  Mar 12: Original sync success (code 29403) — logs have associado_id: NULL
  Mar 13-19: 9 retry cycles, each:
    1. Search CPF → 406 "unavailable"
    2. Register → 406 "CPF exists"
    3. Recovery finds 29403 from identity logs (not filtered — invalidation logs have NULL associado_id)
    4. Vehicle registration with 29403 → 406 "not registered"
    5. Invalidates 29403 — but log written with NULL associado_id (old code path)
    → Repeat
```

## Fix (2 parts)

### Part 1: Fix the `codigosInvalidados` query (prevents future loops)

In `supabase/functions/sga-hinova-sync/index.ts`, change the invalidated codes query to ALSO search logs where `associado_id IS NULL` but the `veiculo_id` matches, since older logs lack `associado_id`:

```typescript
// Current (broken): only finds logs with matching associado_id
.eq('associado_id', _aid)

// Fixed: find invalidation logs by associado_id OR veiculo_id
// Use an OR filter to catch old logs with NULL associado_id
.or(`associado_id.eq.${_aid},veiculo_id.eq.${_vid}`)
```

### Part 2: Fix the immediate data issue (unblocks Marcus Vinicius NOW)

Update the old invalidation logs to have the correct `associado_id`, and reset the queue so the next retry uses the corrected filter. Since the Hinova deadlock (CPF exists but code deleted) cannot be resolved by code alone, the system should detect this pattern and mark it as requiring manual Hinova intervention rather than retrying forever.

Add a new deadlock detection: when `cadastrar_associado` returns "CPF exists" AND the CPF search returns 406 "indisponível", AND all recovery strategies fail (codes invalidated), mark as `falha_permanente` with a clear message for the admin.

### Part 3: Also fix identity log search to check invalidation by veiculo_id

The identity log search (Strategy 2) builds `codigosInvalidados` filtering only by `associado_id`. Add `veiculo_id` to the OR filter so it catches old invalidation logs with NULL `associado_id`.

## Files to Change

**`supabase/functions/sga-hinova-sync/index.ts`**:
1. Line 1013-1019: Change the `codigosInvalidados` query from `.eq('associado_id', _aid)` to `.or(\`associado_id.eq.${_aid},veiculo_id.eq.${_vid}\`)` to catch old logs with NULL `associado_id`
2. Add deadlock detection after all recovery strategies fail: if the CPF search returned "indisponível" (406) AND cadastro returns "CPF exists", log a specific admin-facing error message explaining the Hinova-side issue

**Database fix** (one-time): Update the old invalidation logs to have correct `associado_id` and mark Marcus's queue entry as `falha_permanente` with a clear message about needing manual Hinova intervention.

## Expected Outcome
- The infinite loop is broken immediately for Marcus Vinicius
- Future similar deadlocks (CPF exists but unavailable in Hinova) will be detected and marked as permanent failures with actionable admin messages
- Old logs with NULL `associado_id` will no longer cause the invalidation filter to miss codes


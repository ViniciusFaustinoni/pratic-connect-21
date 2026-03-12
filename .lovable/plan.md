

# Root Cause Analysis: Template `boas_vindas_associado` parameter mismatch

## The Definitive Problem

The database record for `boas_vindas_associado` says `status: APPROVED` with 4 body variables (`{{1}}` to `{{4}}`) + 1 URL button variable. **But the actual template approved on Meta's servers only has 2 body variables** (an older version).

Evidence from logs at 18:09:18:
```
body: number of localizable_params (4) does not match the expected number of params (2)
```

Then at 18:11:41, the auto-retry #2 **silently truncated** to 2 params and "succeeded" -- sending an **incomplete message** with only name and vehicle, dropping coverage and next step.

The database status `APPROVED` is a lie -- it was never updated after the template was resubmitted with 4 variables. The old 2-variable version is what Meta actually has approved.

## Root Cause Chain

1. The old template on Meta has 2 body params (approved long ago)
2. The database was updated locally to have 4 body params but the status was left as `APPROVED` without actually getting Meta to approve the new version
3. The retry #2 (truncation) in `whatsapp-send-text` masks this by sending incomplete messages and reporting success
4. The auto-delete+retry we added to `whatsapp-meta-templates` was never triggered because the user hasn't resubmitted since the fix was deployed

## Fix (2 changes)

### 1. `supabase/functions/whatsapp-send-text/index.ts` -- Remove retry #2 (truncation)

Remove lines 296-337 (the entire "retry #2: truncar" block). This block silently sends incomplete messages and hides the real problem. Keep only retry #1 (button split) which is structurally correct.

Replace with a clear error log:
```typescript
// Do NOT truncate -- that sends incomplete messages
console.error(`[whatsapp-send-text] ❌ Param mismatch definitivo: enviados=${sent}, esperados pela Meta=${expected}. O template na Meta está desatualizado. Reenvie o template pela aba de Templates Meta.`);
```

### 2. Database: Reset template status to force resubmission

Run SQL to mark the template as `DRAFT` so the user is forced to resubmit it through the UI (which will trigger the auto-delete+retry logic we already added):

```sql
UPDATE whatsapp_meta_templates 
SET status = 'DRAFT', meta_template_id = NULL 
WHERE nome = 'boas_vindas_associado';
```

### What happens after the fix

1. The template shows as DRAFT in the UI
2. User clicks "Enviar para aprovação"
3. Our auto-delete+retry detects the old version exists on Meta, deletes it, and recreates with 4 variables
4. Meta reviews and approves (usually minutes for simple templates)
5. After approval, sends will work correctly with all 4 variables + button URL
6. If somehow a mismatch still occurs, the error will now fail loudly instead of sending broken messages

### Summary
- **1 edge function** edited (remove dangerous truncation)
- **1 SQL migration** (reset template to DRAFT)
- No frontend changes needed


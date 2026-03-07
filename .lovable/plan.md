

# Plan: Fix Meta API Messages Failing Due to Missing `provedor` Column

## Root Cause

The `whatsapp_mensagens` table does **not** have a `provedor` column. However, both `whatsapp-send-text` and `whatsapp-send-media` try to insert records with `provedor: "meta_oficial"` when using the Meta path. This causes the database insert to fail, which throws an error and prevents the Meta message from completing -- even though the Meta API call itself may succeed.

The `whatsapp_meta_config` table correctly has `ativo: true`, so the provider selection logic works. The failure happens **after** provider selection, during the message logging step.

## Fix (2 parts)

### 1. Add `provedor` column to `whatsapp_mensagens`
Create a migration to add the missing column:
```sql
ALTER TABLE whatsapp_mensagens ADD COLUMN provedor varchar DEFAULT 'evolution';
```

### 2. Verify edge function inserts
Both `whatsapp-send-text` (lines 181-186, 192-196) and `whatsapp-send-media` already reference `provedor: "meta_oficial"` -- these will work correctly once the column exists. No code changes needed in the edge functions.

## Impact
- All messages will route through Meta API as intended (since `ativo: true` in config)
- Message history will correctly track which provider was used
- Existing records default to `'evolution'`


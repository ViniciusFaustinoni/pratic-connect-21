

# Plan: Fix "Invalid parameter" Error Handling

## Root Cause

The Meta API error log reveals the **real** rejection reason:
- `error_user_msg`: "As variáveis não podem estar no início ou no fim do modelo"
- But the function only saves `result.error?.message` which is the generic "Invalid parameter"

This means:
1. The detailed error message from Meta is lost -- users only see "Invalid parameter"
2. The AI validation also receives "Invalid parameter" instead of the actual reason, making its suggestions less targeted
3. The AI-suggested body still ends with `{{2}}`, which violates the same Meta rule

## Changes

### `supabase/functions/whatsapp-meta-templates/index.ts`
- When saving `motivo_rejeicao`, prefer `error_user_msg` over `message` for a human-readable reason
- Change line 191 and 298: `result.error?.error_user_msg || result.error?.message || "Erro desconhecido"`
- Same for the thrown error on line 196

This single change ensures:
- The rejection reason stored in DB is descriptive (e.g., "As variáveis não podem estar no início ou no fim do modelo")
- The AI validation receives the real reason and can give accurate fixes
- Users see meaningful feedback in the UI

### Files changed
| File | Change |
|------|--------|
| `supabase/functions/whatsapp-meta-templates/index.ts` | Use `error_user_msg` from Meta response for rejection reason (lines 191, 196, 298) |


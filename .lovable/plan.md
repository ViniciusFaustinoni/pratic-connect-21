

# Plan: Include Rejection Reason in AI Validation

## Problem
When a template was previously rejected by Meta (e.g., "Invalid parameter"), that `motivo_rejeicao` is not passed to the AI validation function. The AI should use this context to give targeted advice on how to fix the specific issue that caused rejection.

## Changes

### 1. Edge Function (`supabase/functions/whatsapp-template-validar/index.ts`)
- Accept new optional param `motivo_rejeicao` in the request body (line 16)
- Add it to the user prompt: if present, include a section like `**Motivo da rejeição anterior pela Meta**: ${motivo_rejeicao}` and instruct the AI to specifically address this rejection reason in its suggestions
- Add to the system prompt a rule: "Se o motivo da rejeição anterior for fornecido, priorize resolver esse problema específico nas suas sugestões"
- Add a new output field `corpo_sugerido` (string) to the tool schema — a corrected version of the body text that fixes the identified issues

### 2. Frontend (`src/components/integracoes/WhatsAppMetaTemplateDrawer.tsx`)
- Pass `template?.motivo_rejeicao` in the `body` of the `supabase.functions.invoke` call (line ~104)
- Update `IAValidationResult` interface to include `corpo_sugerido?: string`
- When `corpo_sugerido` is returned, show it in the validation results card with a button "Aplicar sugestão" that replaces the current body text

### Files changed
| File | Change |
|------|--------|
| `supabase/functions/whatsapp-template-validar/index.ts` | Accept `motivo_rejeicao`, add to prompt, add `corpo_sugerido` output |
| `src/components/integracoes/WhatsAppMetaTemplateDrawer.tsx` | Send `motivo_rejeicao`, show suggested body with apply button |


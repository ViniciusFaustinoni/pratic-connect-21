

## Plan: Fix Template Name + Add WhatsApp Tracking to Contracts

### Part 1: Fix template name in 4 edge functions

All four edge functions use `'assinatura_documento'` but the approved Meta template is `'assinatura_documento_v2'`.

**Files to update** (one-line change each):
1. `supabase/functions/autentique-create/index.ts` (line 428)
2. `supabase/functions/autentique-create-by-token/index.ts` (line 519)
3. `supabase/functions/autentique-evento-create/index.ts` (line 467)
4. `supabase/functions/autentique-vistoria-create/index.ts` (line 373)

Change: `template_name: 'assinatura_documento'` → `template_name: 'assinatura_documento_v2'`

### Part 2: Add WhatsApp tracking columns to contratos

**Database migration**: Add 3 columns to `contratos`:
```sql
ALTER TABLE public.contratos
  ADD COLUMN whatsapp_enviado boolean DEFAULT false,
  ADD COLUMN whatsapp_enviado_em timestamptz,
  ADD COLUMN whatsapp_erro text;
```

### Part 3: Update edge functions to record WhatsApp status

In `autentique-create` and `autentique-create-by-token`, after the WhatsApp send attempt, update the contrato record:
- On success: `whatsapp_enviado = true, whatsapp_enviado_em = now()`
- On failure: `whatsapp_erro = error.message`

### Part 4: Visual indicator in Contratos page

In `src/pages/vendas/Contratos.tsx`, add a small WhatsApp icon indicator next to each contract row:
- Green MessageCircle icon if `whatsapp_enviado === true`
- Red/warning icon if `whatsapp_erro` exists
- No icon if neither (not yet sent)

Also add the same indicator in `ContratoDetailDrawer.tsx` in the contract details section.

### Files changed
1. `supabase/functions/autentique-create/index.ts` — fix template name + record WhatsApp status
2. `supabase/functions/autentique-create-by-token/index.ts` — fix template name + record WhatsApp status
3. `supabase/functions/autentique-evento-create/index.ts` — fix template name
4. `supabase/functions/autentique-vistoria-create/index.ts` — fix template name
5. Database migration — add 3 columns to contratos
6. `src/pages/vendas/Contratos.tsx` — WhatsApp status indicator
7. `src/components/contratos/ContratoDetailDrawer.tsx` — WhatsApp status in detail view


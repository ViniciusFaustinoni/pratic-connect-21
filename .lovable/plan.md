

# Plan: Fix WhatsApp Message Sending (Meta API Migration)

## Root Cause Analysis

There are **4 distinct problems** preventing WhatsApp messages from being sent after switching from Evolution to Meta API:

### Problem 1: Parameter Name Mismatch
Multiple callers invoke `whatsapp-send-text` with `{ phone, message }` instead of the expected `{ telefone, mensagem }`. The function destructures `telefone` and `mensagem`, so these calls silently fail with "telefone e mensagem sao obrigatorios".

**Affected files (edge functions):**
- `analisar-evento/index.ts` -- uses `phone` + `message`
- `asaas-webhook/index.ts` -- uses `phone` + `message`
- `EnviarParaOficinaDialog.tsx` -- uses `phone` + `message`

**Fix:** Update `whatsapp-send-text` to accept BOTH parameter names with a fallback:
```typescript
const telefone = body.telefone || body.phone;
const mensagem = body.mensagem || body.message;
```

### Problem 2: `disparar-notificacao` calls non-existent function
The centralized notification hub calls `supabase.functions.invoke('enviar-whatsapp', ...)` -- this function does NOT exist. It should call `whatsapp-send-text`.

**Fix:** Change the invoke target from `'enviar-whatsapp'` to `'whatsapp-send-text'` and map the body parameters correctly.

### Problem 3: `notificar-retirada-whatsapp` and `notificar-manutencao-whatsapp` still use n8n webhooks
These two functions send messages exclusively via n8n webhook (`N8N_WEBHOOK_URL_RETIRADA` / `N8N_WEBHOOK_URL_MANUTENCAO`), which are likely not configured. They should use the `whatsapp-send-text` function instead.

**Fix:** Replace the n8n webhook calls with `supabase.functions.invoke('whatsapp-send-text', ...)`.

### Problem 4: `whatsapp-send-media` requires `media_url` for Meta but callers send `media_base64`
The Meta path in `enviarMediaViaMeta` (line 46) throws an error if `media_url` is missing: `"media_url é obrigatório para envio via Meta"`. However, many callers (e.g., `ativar-associado`, `app-primeiro-acesso`) send `media_base64` without a `media_url`. The Meta API requires uploading media first or providing a public URL.

**Fix:** Add a base64-to-upload flow in `enviarMediaViaMeta`: upload the base64 data to Supabase Storage, get a public URL, then send via Meta API. This makes both `media_url` and `media_base64` work seamlessly.

## Implementation Steps

1. **Update `whatsapp-send-text/index.ts`** -- Accept both `phone`/`message` and `telefone`/`mensagem` parameter names with fallback aliases
2. **Update `whatsapp-send-media/index.ts`** -- Handle `media_base64` for Meta by uploading to Supabase Storage first, then sending the public URL
3. **Update `disparar-notificacao/index.ts`** -- Change `'enviar-whatsapp'` to `'whatsapp-send-text'` with correct parameter mapping
4. **Update `notificar-retirada-whatsapp/index.ts`** -- Replace n8n webhook with `whatsapp-send-text` call
5. **Update `notificar-manutencao-whatsapp/index.ts`** -- Replace n8n webhook with `whatsapp-send-text` call
6. **Deploy all 5 edge functions and verify via logs**

## Impact
This fixes ALL WhatsApp sending paths in the system -- text messages, media/documents, centralized notifications, and operational alerts (retirada/manutencao). No frontend changes needed.




# Plan: Fix WhatsApp Messages in Associate Activation Flow

## Current Status (Based on Logs)

The `notificar-cliente` function and `whatsapp-send-text` are **working correctly** as of the latest deployment. Logs from 22:56 today confirm:
- `proposta_aprovada_roubo_furto` template was processed
- WhatsApp was sent via Meta API successfully (message ID confirmed)
- Email was also sent successfully

The welcome message when approving a proposal ("Bem-vindo à PRATIC!") **is now functional**.

## Remaining Bug Found

**`ativar-associado/index.ts` (line 230)**: Calls `whatsapp-send-media` to send a **plain text message** (login credentials). This function requires `media_type` and `mimetype` parameters, which are not provided. This means the access credentials WhatsApp message silently fails every time.

```
// Current (broken) - calls media function for text
await supabaseAdmin.functions.invoke('whatsapp-send-media', {
  body: { telefone, mensagem }  // missing media_type, mimetype
});
```

**Fix**: Change to `whatsapp-send-text` which is the correct function for text messages.

## Implementation

1. **Update `ativar-associado/index.ts`** line 230: Change `whatsapp-send-media` to `whatsapp-send-text` and use correct parameter names (`telefone`, `mensagem`).

2. **Deploy and verify** via edge function logs.

This is a single-line fix in one file. No other broken WhatsApp paths remain -- all other callers (`notificar-cliente`, `disparar-notificacao`, `notificar-retirada-whatsapp`, `notificar-manutencao-whatsapp`) were already corrected in the previous round of fixes.


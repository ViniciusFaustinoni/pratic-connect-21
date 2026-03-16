

## Plano: Corrigir mapeamento do payload Chatwoot

### Problema

O payload real do Chatwoot tem uma estrutura diferente do que foi implementado:

- **Evento**: `body.event` = `"automation_event.message_created"` (não `"message_created"`)
- **message_type**: está em `body.messages[0].message_type` = `0` (não no root)
- **content**: está em `body.messages[0].content` (não no root)
- **Telefone**: `body.contact_inbox.source_id` = `"557181719761"` ou `body.meta.sender.phone_number` = `"+557181719761"`
- **Nome**: `body.meta.sender.name`
- **message_id**: `body.messages[0].id`

### Edição: `supabase/functions/chatwoot-webhook/index.ts`

Reescrever a extração de dados para mapear corretamente:

1. **Evento**: aceitar tanto `"message_created"` quanto `"automation_event.message_created"`
2. **Mensagem**: extrair de `payload.messages[0]` (primeiro item do array)
3. **message_type**: pegar de `messages[0].message_type` (valor `0` = incoming)
4. **content**: pegar de `messages[0].content`
5. **Telefone**: priorizar `payload.contact_inbox?.source_id`, fallback `payload.meta?.sender?.phone_number`
6. **Nome**: pegar de `payload.meta?.sender?.name`
7. **message_id**: usar `messages[0].source_id` (wamid) ou `messages[0].id`

```typescript
// Novo mapeamento baseado no payload real
const event = payload.event || "";
if (!event.includes("message_created")) { /* ignorar */ }

const msg = payload.messages?.[0] || {};
const messageType = msg.message_type;
if (messageType !== 0 && messageType !== "incoming") { /* ignorar */ }

const content = msg.content || "";
const telefone = (payload.contact_inbox?.source_id || payload.meta?.sender?.phone_number || "")
  .replace(/\D/g, "");
const nomeContato = payload.meta?.sender?.name || "Desconhecido";
const messageId = msg.source_id ? `chatwoot_${msg.source_id}` : `chatwoot_${msg.id || Date.now()}`;
```

### Deploy e teste automático após edição


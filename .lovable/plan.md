

## Plano: Criar Webhook para receber mensagens do Chatwoot

### Objetivo
Criar uma nova Edge Function `chatwoot-webhook` que recebe eventos do Chatwoot e os processa no mesmo fluxo existente (salvar mensagem, delegar para IA se aplicável).

### URL final do webhook
```
https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/chatwoot-webhook
```

### O que será criado

**1. Edge Function `supabase/functions/chatwoot-webhook/index.ts`**

- Recebe POST do Chatwoot com eventos `message_created`, `message_updated`, `conversation_created`, etc.
- Extrai telefone, texto, tipo de mensagem e nome do contato do payload do Chatwoot
- Filtra apenas mensagens de entrada (`incoming`) — ignora mensagens enviadas pelo agente
- Salva na tabela `whatsapp_mensagens` com `provedor: 'chatwoot'`
- Delega para a fila IA (`whatsapp_fila_ia`) para associados ativos, seguindo o mesmo fluxo do webhook Meta
- Retorna 200 OK imediatamente (padrão fire-and-forget)
- CORS habilitado, JWT desabilitado

**2. Configuração em `supabase/config.toml`**
```toml
[functions.chatwoot-webhook]
verify_jwt = false
```

### Payload do Chatwoot (referência)
O Chatwoot envia eventos com esta estrutura:
```json
{
  "event": "message_created",
  "message_type": "incoming",
  "content": "Texto da mensagem",
  "conversation": {
    "contact_inbox": {
      "source_id": "5511999998888@s.whatsapp.net"
    }
  },
  "sender": {
    "name": "João Silva",
    "phone_number": "+5511999998888"
  }
}
```

### Segurança
- Suporte a header `X-Chatwoot-Token` para validar que a requisição vem do Chatwoot (opcional, configurável via secret `CHATWOOT_WEBHOOK_TOKEN`)

### Nenhuma migração de banco necessária
As tabelas `whatsapp_mensagens` e `whatsapp_fila_ia` já suportam o campo `provedor` e aceitam os dados necessários.


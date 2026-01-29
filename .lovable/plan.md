
# Plano de Correção: IA não responde no WhatsApp

## Diagnóstico

Após investigação detalhada, identifiquei a **causa raiz** do problema:

### O que estava acontecendo

O webhook `whatsapp-webhook` **funciona corretamente** quando chamado diretamente (teste confirmado), mas a **Evolution API não estava chamando o webhook** quando mensagens reais chegavam.

### Causa raiz identificada

Na configuração do webhook enviada para a Evolution API, está sendo usado:

```javascript
webhook_by_events: true
```

Quando `webhook_by_events: true`, a Evolution API **não envia para a URL configurada**, mas sim para URLs derivadas por evento:
- `https://...webhook/messages-upsert` 
- `https://...webhook/connection-update`
- etc.

Como o Supabase não tem essas rotas, as chamadas falham silenciosamente.

### Evidências

1. Teste direto do webhook → **funcionou** (IA respondeu)
2. Logs da edge function mostram execução correta quando chamada
3. Mensagens enviadas em 28/01 funcionaram (antes de alguma reconfiguração)
4. Não há logs de webhooks recebidos diretamente da Evolution

---

## Solução

Alterar `webhook_by_events` de `true` para `false` na função `whatsapp-set-webhook/index.ts`.

### Alteração necessária

**Arquivo:** `supabase/functions/whatsapp-set-webhook/index.ts`

**Linha 51:** Alterar de:
```javascript
webhook_by_events: true,
```

Para:
```javascript
webhook_by_events: false,
```

---

## Detalhes Técnicos

### Comportamento com `webhook_by_events: false`
- Evolution envia **todos os eventos** para a URL única configurada
- O campo `event` no payload indica o tipo de evento (ex: `"messages.upsert"`)
- O código atual já trata isso corretamente na linha 831:
  ```javascript
  if (payload.event !== "messages.upsert") { ... }
  ```

### Comportamento com `webhook_by_events: true` (atual - ERRADO)
- Evolution envia para URLs separadas: `/messages-upsert`, `/connection-update`
- A URL base é ignorada
- Como não existem essas rotas no Supabase, nada funciona

---

## Passos de Implementação

1. Editar `supabase/functions/whatsapp-set-webhook/index.ts`
2. Alterar linha 51: `webhook_by_events: false`
3. Deploy da edge function
4. Chamar endpoint para reconfigurar webhook na Evolution

---

## Verificação Pós-Deploy

Após a correção:
1. Acessar configurações de integração WhatsApp no sistema
2. Clicar em "Configurar Webhook" para reenviar a configuração
3. Enviar uma mensagem de teste para o número conectado
4. Verificar nos logs se a mensagem foi processada

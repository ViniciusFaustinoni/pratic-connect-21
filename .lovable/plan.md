

## Diagnóstico: Meta não está enviando mensagens para o webhook

### Problema encontrado

Testei a edge function `whatsapp-meta-webhook` manualmente e ela funciona perfeitamente:
- Verificação GET: OK
- Simulação de mensagem POST: encontrou o associado, delegou para `whatsapp-webhook`, IA respondeu

**Porém**: não existe nenhuma mensagem de entrada (`direcao = 'entrada'`) com `provedor = 'meta_oficial'` no banco. Ou seja, **a Meta nunca chamou o webhook**. O problema não é no código — é na configuração do webhook no painel da Meta.

### O que precisa ser feito

**No painel Meta for Developers (developers.facebook.com):**

1. Acessar o App WhatsApp > Configuração > Webhooks
2. Verificar se o **Callback URL** está configurado como:
   ```
   https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/whatsapp-meta-webhook
   ```
3. Verificar se o **Verify Token** é: `sga_pratic_meta_webhook`
4. Verificar se os **campos de webhook** estão inscritos:
   - `messages` (obrigatório para receber mensagens)
   - `message_template_status_update` (para status de templates)

### Bug secundário encontrado (para corrigir no código)

No `whatsapp-webhook/index.ts` linha 2958, quando `isMetaDelegate` é true:
```typescript
const apiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;
```
O `EVOLUTION_API_URL` env var sobrescreve a instância sintética vazia. Mesmo que o fallback no `sendWhatsAppMessage` funcione (porque `instanceName` é `""`), várias chamadas diretas ao `apiUrl` no código (linhas 3126, 3162, etc.) usam `apiUrl` + `instancia.instance_name` diretamente, sem passar pelo fallback. Isso causaria erros em fluxos como vinculação de mídia a sinistro/cadastro.

**Correção**: Quando `isMetaDelegate` é true, forçar `apiUrl = ""` para garantir que todas as chamadas usem o proxy.

### Plano de implementação

1. **`supabase/functions/whatsapp-webhook/index.ts`** — Na linha 2958, alterar para:
   ```typescript
   const apiUrl = isMetaDelegate ? "" : (Deno.env.get('EVOLUTION_API_URL') || instancia.api_url);
   ```

2. **Verificação do webhook na Meta** — Você precisa confirmar no painel developers.facebook.com que o Callback URL e os campos estão configurados corretamente. Essa parte é manual, no painel da Meta.


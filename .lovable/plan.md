
## Diagnóstico: Por que a IA não responde via Meta API

### Bugs encontrados (2 problemas no código)

Testei manualmente o webhook — ele funciona, recebe o payload da Meta corretamente e parseia `entry[].changes[].value.messages[]` sem problemas. **O parsing do formato Meta está CORRETO no código.**

Porém, o INSERT da mensagem de entrada **falha silenciosamente** por violar constraints do banco:

**Bug 1: Status inválido**
O código insere `status: "recebida"`, mas a constraint `whatsapp_mensagens_status_check` só permite: `pendente`, `enviando`, `enviada`, `entregue`, `lida`, `erro`, `cancelada`.

**Bug 2: Tipo inválido para certos tipos de mensagem**
O código faz `tipo: msg.type === "text" ? "text" : msg.type`, mas a constraint `whatsapp_mensagens_tipo_check` só permite: `text`, `image`, `document`, `audio`, `video`, `template`. Mensagens do tipo `button`, `location`, `sticker`, `reaction` etc. causam falha no INSERT.

Como o erro não é tratado, a função retorna `{"success": true}` para a Meta mas **a mensagem nunca é salva** e **o processamento pode falhar** dependendo do timing.

### Evidência
Meu teste manual enviou payload de teste com "Bati de carro" → função processou → mas 0 registros no banco para aquele `message_id`. A constraint de status bloqueou o INSERT.

### Plano de correção

**1. `supabase/functions/whatsapp-meta-webhook/index.ts`** — Corrigir o INSERT (linha 561-570):

- Mudar `status: "recebida"` → `status: "entregue"` (valor válido para mensagens recebidas)
- Normalizar o `tipo` para valores válidos: mapear `location`, `button`, `sticker`, `reaction`, `contacts` → `"text"`
- Adicionar tratamento de erro no INSERT com log

**2. Adicionar log de erro** no INSERT para nunca mais falhar silenciosamente

Nenhuma alteração de schema necessária — os valores existentes são suficientes.

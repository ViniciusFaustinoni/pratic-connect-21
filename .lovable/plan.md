

## Diagnóstico: Formato alternativo do payload Meta não é processado

### Problema Raiz

O webhook da Meta envia **dois formatos** diferentes de payload:

**Formato 1 (padrão)** — funciona hoje:
```json
{
  "object": "whatsapp_business_account",
  "entry": [{ "changes": [{ "field": "messages", "value": { "messages": [...] } }] }]
}
```

**Formato 2 (direto `field/value`)** — NÃO funciona:
```json
{
  "field": "messages",
  "value": { "messages": [{ "from": "5521992593830", "text": { "body": "Bati de carro" } }] }
}
```

No `whatsapp-meta-webhook` (linha 522), `body.entry` é `undefined` no formato 2, resultando em `entries = []`. A mensagem é simplesmente ignorada — nenhum processamento, nenhum erro, nenhuma resposta. O webhook retorna `{ success: true, messages: 0 }`.

No `whatsapp-webhook` (linha 2532), a blindagem verifica `payload.object === "whatsapp_business_account"`, que também é falso no formato 2.

### Evidências
- A mensagem "Bati de carro" do Marcus (14:36) foi inserida com `message_id: wamid.manual_assoc_1` (inserção manual/teste), e a IA processou e salvou em `chat_mensagens_ia` — mas **nenhuma mensagem de saída** existe em `whatsapp_mensagens` após 14:36
- Nenhum log de `whatsapp-meta-webhook` ou `whatsapp-webhook` aparece nos analytics para essa mensagem
- Telemetria confirma que o webhook recebe payloads (last_webhook_at = 15:46), mas apenas formato 1

### Solução

Adicionar detecção do formato 2 (`field/value` direto) em **dois pontos**:

**1. `supabase/functions/whatsapp-meta-webhook/index.ts`** (prioridade):
- Após fazer `body = await req.json()`, antes de iterar `entries`:
- Se `body.field` existir e `body.value` existir (sem `body.entry`), normalizar para o formato padrão:
  ```
  entries = [{ changes: [{ field: body.field, value: body.value }] }]
  ```
- O resto do código funciona igual, pois já processa `field` e `value`

**2. `supabase/functions/whatsapp-webhook/index.ts`** (blindagem):
- Expandir a condição da linha 2532 para também detectar `payload.field === "messages"` e encaminhar para `whatsapp-meta-webhook`

### Arquivos a Editar
- `supabase/functions/whatsapp-meta-webhook/index.ts` — normalizar formato 2 para formato 1
- `supabase/functions/whatsapp-webhook/index.ts` — blindagem para formato 2

### Impacto
- Mensagens no formato `{ field, value }` passarão a ser processadas corretamente
- A IA (Maya) responderá ao Marcus e qualquer associado cujas mensagens cheguem nesse formato


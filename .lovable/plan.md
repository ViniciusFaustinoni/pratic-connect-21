

# Revisao Completa - Configuracao de Webhooks para Evolution API

## Resumo Executivo

| Aspecto | Status | Observacao |
|---------|--------|------------|
| URL do webhook acessivel externamente | **OK** | `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/whatsapp-webhook` |
| Evento MESSAGES_UPSERT (mensagens recebidas) | **OK** | Configurado |
| Evento MESSAGES_UPDATE (status entrega) | **CONFIGURADO MAS NAO PROCESSADO** | Evento registrado mas sem handler |
| Evento CONNECTION_UPDATE (desconexoes) | **OK** | Funcionando com alertas para diretores |
| Headers de autorizacao | **OK** | apikey enviada pela Evolution API |
| byEvents configurado | **NAO** | `webhook_by_events: false` (envia todos eventos para mesma URL) |
| Processamento de status de entrega | **NAO IMPLEMENTADO** | Falta handler para atualizar delivered_at e read_at |
| Resposta rapida do webhook | **OK** | Responde em menos de 200ms |

---

## Analise Detalhada

### 1. Configuracao do Webhook (whatsapp-set-webhook)

**Configuracao atual:**

```typescript
const webhookPayload = {
  url: WEBHOOK_URL,  // https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/whatsapp-webhook
  enabled: true,
  webhook_by_events: false,  // Todos eventos vao para mesma URL
  webhook_base64: false,
  events: [
    'MESSAGES_UPSERT',    // ✅ Mensagens recebidas
    'MESSAGES_UPDATE',    // ⚠️ Configurado mas nao processado
    'CONNECTION_UPDATE'   // ✅ Desconexoes
  ]
};
```

**Status no banco:**
- `webhook_enabled: true`
- `webhook_url: https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/whatsapp-webhook`
- `webhook_events: [MESSAGES_UPSERT, MESSAGES_UPDATE, CONNECTION_UPDATE]`

### 2. Processamento de Eventos no Webhook

**MESSAGES_UPSERT (mensagens recebidas):** FUNCIONANDO

```typescript
if (payload.event === "messages.upsert") {
  // ✅ Processa mensagens de entrada
  // ✅ Identifica associado pelo telefone
  // ✅ Responde via IA
  // ✅ Registra em whatsapp_mensagens
}
```

**CONNECTION_UPDATE (desconexoes):** FUNCIONANDO

```typescript
if (payload.event === "connection.update") {
  // ✅ Detecta state: open, close, connecting
  // ✅ Atualiza status no banco
  // ✅ Cria notificacao para diretores se desconectar
  // ✅ Registra log da desconexao
}
```

**MESSAGES_UPDATE (status de entrega):** NAO IMPLEMENTADO

O evento `MESSAGES_UPDATE` e recebido pela Evolution API quando:
- Mensagem foi **enviada** (status: DELIVERY_ACK)
- Mensagem foi **entregue** (status: DELIVERY_ACK)
- Mensagem foi **lida** (status: READ)

Atualmente, este evento e **ignorado** no webhook:

```typescript
// Linha 1399
if (payload.event !== "messages.upsert") {
  console.log(`[whatsapp-webhook] Evento ignorado: ${payload.event}`);
  return new Response(JSON.stringify({ ok: true, ignored: true, event: payload.event }), ...);
}
```

### 3. Gaps Identificados

#### Gap 1: Status de Entrega Nao Atualizado

A tabela `whatsapp_mensagens` possui campos para rastrear status:
- `sent_at` (timestamp quando enviada)
- `delivered_at` (timestamp quando entregue) - NUNCA PREENCHIDO
- `read_at` (timestamp quando lida) - NUNCA PREENCHIDO
- `status` (pendente, enviando, enviada, entregue, lida, erro) - SO USA "enviada" e "entregue"

#### Gap 2: Nao Ha Log de Eventos MESSAGES_UPDATE

Os logs mostram apenas eventos `connection.update`. Eventos de status de mensagens nao estao sendo registrados.

---

## Plano de Implementacao

### Adicionar Handler para MESSAGES_UPDATE

**Modificar:** `supabase/functions/whatsapp-webhook/index.ts`

Adicionar processamento de eventos de status apos o handler de CONNECTION_UPDATE:

```typescript
// PROCESSAR EVENTOS DE STATUS DE MENSAGEM (MESSAGES_UPDATE)
if (payload.event === "messages.update") {
  console.log('[whatsapp-webhook] MESSAGES_UPDATE recebido');
  
  const updates = payload.data?.messages || payload.data || [];
  
  for (const update of Array.isArray(updates) ? updates : [updates]) {
    const messageId = update.key?.id;
    const status = update.status || update.update?.status;
    
    if (!messageId) continue;
    
    console.log(`[whatsapp-webhook] Status update: ${messageId} -> ${status}`);
    
    // Mapear status da Evolution para nosso status
    const statusMap: Record<number, { status: string; field: string }> = {
      0: { status: 'erro', field: '' },
      1: { status: 'pendente', field: '' },
      2: { status: 'enviada', field: 'sent_at' },
      3: { status: 'entregue', field: 'delivered_at' },
      4: { status: 'lida', field: 'read_at' },
      5: { status: 'reproduzida', field: 'read_at' }, // Para audio/video
    };
    
    const statusInfo = statusMap[status];
    
    if (statusInfo) {
      const updateData: Record<string, any> = {
        status: statusInfo.status,
        updated_at: new Date().toISOString(),
      };
      
      if (statusInfo.field) {
        updateData[statusInfo.field] = new Date().toISOString();
      }
      
      // Atualizar mensagem no banco
      const { error } = await supabase
        .from('whatsapp_mensagens')
        .update(updateData)
        .eq('message_id', messageId);
      
      if (error) {
        console.error(`[whatsapp-webhook] Erro ao atualizar status: ${error.message}`);
      } else {
        console.log(`[whatsapp-webhook] Status atualizado: ${messageId} -> ${statusInfo.status}`);
      }
    }
  }
  
  return new Response(JSON.stringify({ ok: true, event: 'messages.update' }), { headers: corsHeaders });
}
```

### Corrigir Salvamento do message_id

Atualmente, algumas mensagens nao salvam o `message_id` retornado pela Evolution API, dificultando a atualizacao de status.

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts` (funcao sendWhatsAppMessage)

Atualizar para retornar o message_id:

```typescript
async function sendWhatsAppMessage(apiUrl: string, instanceName: string, telefone: string, texto: string): Promise<{ ok: boolean; messageId?: string }> {
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  if (!EVOLUTION_API_KEY) throw new Error("EVOLUTION_API_KEY não configurada");

  const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
    },
    body: JSON.stringify({
      number: telefone,
      text: texto,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[whatsapp-webhook] Erro ao enviar: ${err}`);
    return { ok: false };
  }

  const result = await response.json();
  return { ok: true, messageId: result?.key?.id };
}
```

E atualizar a funcao `saveWhatsAppLog` para receber e salvar o message_id:

```typescript
async function saveWhatsAppLog(
  supabase: any, 
  instanciaId: string, 
  telefone: string, 
  mensagem: string, 
  direcao: string,
  messageId?: string
) {
  await supabase.from("whatsapp_mensagens").insert({
    instancia_id: instanciaId,
    telefone,
    tipo: "text",
    mensagem,
    direcao,
    status: direcao === "saida" ? "enviada" : "entregue",
    message_id: messageId || null,
    sent_at: direcao === "saida" ? new Date().toISOString() : null,
  });
}
```

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar handler MESSAGES_UPDATE e melhorar salvamento de message_id |

---

## Verificacoes Pos-Implementacao

### Checklist de Testes

- [ ] Enviar mensagem de teste e verificar se `sent_at` e preenchido
- [ ] Verificar se status muda para "entregue" quando destinatario recebe
- [ ] Verificar se status muda para "lida" quando destinatario abre
- [ ] Confirmar que desconexoes geram alerta para diretores
- [ ] Verificar tempo de resposta do webhook (deve ser <500ms)
- [ ] Testar reconexao automatica do webhook

### Consulta para Verificar Status

```sql
SELECT 
  telefone,
  mensagem,
  status,
  sent_at,
  delivered_at,
  read_at,
  message_id
FROM whatsapp_mensagens 
WHERE direcao = 'saida' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## Detalhes Tecnicos

### Formato do Evento MESSAGES_UPDATE da Evolution API

```json
{
  "event": "messages.update",
  "instance": "sga-pratic",
  "data": {
    "key": {
      "remoteJid": "5599999999999@s.whatsapp.net",
      "fromMe": true,
      "id": "BAE5B1234567890"
    },
    "update": {
      "status": 3  // 2=enviada, 3=entregue, 4=lida
    }
  }
}
```

### Mapeamento de Status

| Codigo | Status Evolution | Status Sistema |
|--------|------------------|----------------|
| 0 | ERROR | erro |
| 1 | PENDING | pendente |
| 2 | SERVER_ACK | enviada |
| 3 | DELIVERY_ACK | entregue |
| 4 | READ | lida |
| 5 | PLAYED | reproduzida |

---

## Nota sobre Configuracoes Adicionais

### webhook_by_events

Atualmente `webhook_by_events: false`, o que significa que todos os eventos vao para a mesma URL. Isso e o recomendado para simplificar.

Se preferir separar endpoints por tipo de evento, seria necessario:
1. Criar edge functions separadas (ex: `whatsapp-webhook-messages`, `whatsapp-webhook-status`)
2. Configurar `webhook_by_events: true`
3. A Evolution API enviara para endpoints especificos por evento

### Eventos Adicionais Opcionais

A Evolution API suporta outros eventos que podem ser uteis:

| Evento | Descricao | Recomendacao |
|--------|-----------|--------------|
| `QRCODE_UPDATED` | Novo QR code gerado | Util para exibir QR code em tempo real |
| `CALL` | Chamadas recebidas | Opcional |
| `PRESENCE_UPDATE` | Online/Offline/Digitando | Util para UX avancada |
| `CHATS_UPDATE` | Atualizacoes de conversas | Opcional |
| `GROUPS_UPSERT` | Atualizacoes de grupos | Ignorar se nao usa grupos |



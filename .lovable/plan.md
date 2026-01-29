
# Plano: Configurar Webhook Evolution API Automaticamente

## Diagnóstico

O sistema de WhatsApp está conectado (status "open"), mas **o webhook não está configurado na Evolution API**. O problema foi identificado:

| Verificação | Resultado |
|-------------|-----------|
| Edge function `whatsapp-webhook` | OK - Deploy correto |
| Instância Evolution API | OK - Status "open" (conectada) |
| Webhook registrado na Evolution | FALHA - Não configurado |
| `webhook_url` no banco | NULL - Vazio |
| Logs de chamadas ao webhook | Nenhum - Evolution não está enviando |

## Causa Raiz

Quando o QR Code é escaneado e a instância conecta, o sistema **não chama a API da Evolution para registrar o webhook**. O endpoint `/webhook/set/{instance_name}` nunca é chamado.

---

## Solução Proposta

### 1. Criar Edge Function para Configurar Webhook

**Novo arquivo**: `supabase/functions/whatsapp-set-webhook/index.ts`

Esta function vai:
- Receber o `instancia_id`
- Chamar `POST /webhook/set/{instance_name}` na Evolution API
- Configurar os eventos `messages.upsert` e `connection.update`
- Atualizar a tabela `whatsapp_instancias` com `webhook_url` e `webhook_enabled`

### 2. Chamar Automaticamente ao Conectar

**Modificar**: `supabase/functions/whatsapp-status/index.ts`

Quando o status mudar para "open" (conectado):
- Chamar automaticamente a configuração do webhook
- Registrar log de sucesso/erro

### 3. Adicionar Botão Manual na Interface

**Modificar**: `src/components/whatsapp/ConfiguracaoEvolutionURL.tsx`

Adicionar:
- Botão "Configurar Webhook" para ativar manualmente
- Indicador visual se webhook está configurado
- Mostrar a URL do webhook configurada

---

## Detalhes Técnicos

### Edge Function: whatsapp-set-webhook

```text
POST /webhook/set/{instance_name}
Headers: apikey: EVOLUTION_API_KEY
Body: {
  "url": "https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/whatsapp-webhook",
  "webhook_by_events": true,
  "events": [
    "messages.upsert",
    "messages.update", 
    "connection.update"
  ]
}
```

### Modificações em whatsapp-status

Quando status = "open", adicionar:
```javascript
// Configurar webhook automaticamente ao conectar
if (status === "open") {
  await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-set-webhook`, {
    method: "POST",
    body: JSON.stringify({ instancia_id })
  });
}
```

### Interface do Usuário

Adicionar na tela de configuração:
- Card mostrando status do webhook (Configurado/Não configurado)
- URL do webhook
- Botão para reconfigurar manualmente

---

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-set-webhook/index.ts` | Criar - Configura webhook na Evolution |
| `supabase/functions/whatsapp-status/index.ts` | Modificar - Auto-configurar webhook ao conectar |
| `supabase/config.toml` | Adicionar nova function |
| `src/components/whatsapp/ConfiguracaoEvolutionURL.tsx` | Adicionar botão e status do webhook |

---

## Resultado Esperado

Após implementação:

1. Ao escanear QR Code e conectar, webhook será configurado automaticamente
2. Mensagens enviadas no WhatsApp chegarão ao webhook
3. IA processará e responderá automaticamente
4. Usuário poderá ver status do webhook na interface
5. Botão manual para reconfigurar se necessário

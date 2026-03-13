

## Problem

The `enviar-link-reagendamento` Edge Function currently sends a **free-text message** (lines 58-71), which is **silently blocked** by `whatsapp-send-text` when Meta API is active (line 202-210: "BLOQUEADO: Meta API ativa requer template_name"). The associate never receives the reagendamento link.

## Solution

### 1. Create Meta WhatsApp Template: `reagendamento_servico`

Submit a new template to Meta with a dynamic URL button:

```
Nome: reagendamento_servico
Categoria: UTILITY

Corpo:
Olá {{1}}, infelizmente seu(sua) {{2}} não pôde ser realizado(a) conforme agendado.

Clique no botão abaixo para escolher uma nova data, horário e endereço. É rápido e fácil!

Equipe PRATIC 🚗

Botão URL dinâmico:
Texto: "Reagendar agora"
URL: https://pratic-connect-21.lovable.app/reagendar/{{1}}
```

Variables: `{{1}}` = primeiro nome, `{{2}}` = tipo do serviço (ex: "instalação do rastreador")
Button: `{{1}}` = reagendamento_token

This template needs to be submitted to Meta for approval. We'll register it in `whatsapp_meta_templates` via SQL migration.

### 2. Update `enviar-link-reagendamento` Edge Function

Replace the free-text send with a template-based send:

```typescript
// BEFORE (blocked by Meta guard):
body: { telefone, mensagem, referencia_tipo, referencia_id }

// AFTER (uses approved template):
body: {
  telefone,
  mensagem, // fallback for Evolution
  template_name: 'reagendamento_servico',
  template_params: [primeiroNome, tipoLabel],
  template_button_params: [servico.reagendamento_token],
  referencia_tipo: 'reagendamento_vistoria',
  referencia_id: servico_id,
}
```

### 3. Register template in DB (SQL migration)

Insert into `whatsapp_meta_templates` so `whatsapp-send-text` can find it. Status will be `PENDING` until Meta approves — we'll also trigger sync via the existing `whatsapp-meta-templates` Edge Function.

### Files changed
- **Edit**: `supabase/functions/enviar-link-reagendamento/index.ts` — use template instead of free text
- **New**: SQL migration — insert `reagendamento_servico` template record
- **Deploy**: `enviar-link-reagendamento` Edge Function

### Important note
The template needs Meta approval before messages are delivered. Until approved, sends will fail with "template not approved" error. The user should submit this template via the Meta templates management UI or sync it after creating it in the Meta Business Manager.


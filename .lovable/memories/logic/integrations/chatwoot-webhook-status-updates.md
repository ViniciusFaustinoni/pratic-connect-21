---
name: chatwoot-webhook-status-updates
description: Pipeline canônico de delivery/read (entregue/lida) entra pelo chatwoot-webhook no evento message_updated; meta-webhook fica como fallback inativo
type: feature
---

Chatwoot é o barramento atual do WhatsApp neste projeto. A Meta foi reapontada para o Chatwoot em ~abril/26 (last_webhook_at de whatsapp_meta_config travou em 2026-04-05) — o `whatsapp-meta-webhook` continua existindo e tem handler de `statuses` (linhas 1086-1103), mas funciona só como fallback caso a Meta volte a apontar direto.

Fluxo canônico atual:

- **Saída** (Maya/operador) → `whatsapp-send-text` → Meta API → grava `whatsapp_mensagens` com `message_id = wamid...` (sem prefixo) e `status = 'enviada'`.
- **Entrada** (cliente) → WhatsApp → Meta → Chatwoot → `chatwoot-webhook` evento `message_created` → grava `whatsapp_mensagens` com `message_id = chatwoot_wamid...` e `status = 'entregue'`.
- **Status delivered/read da saída** → WhatsApp → Meta → Chatwoot → `chatwoot-webhook` evento `message_updated` → UPDATE em `whatsapp_mensagens.status`.

Regras do branch `message_updated` no `chatwoot-webhook`:

1. Lê `payload.messages?.[0].status` e `source_id`.
2. Mapeia: `sent → enviada`, `delivered → entregue`, `read → lida`, `failed → erro`.
3. Casa por `message_id IN (source_id, 'chatwoot_' || source_id)` — cobre saída Meta-direta e qualquer linha prefixada.
4. Preenche `delivered_at` quando vira entregue; `read_at` quando vira lida (e força `delivered_at` se ainda NULL).
5. **Defesa anti-regressão**: NUNCA sobrescreve status mais avançado com um anterior. Implementado com `.not('status', 'in', '(...)')` para os níveis acima do novo (`enviada<entregue<lida/reproduzida`).
6. NÃO enfileira IA em `message_updated` — fila é só para `message_created` de entrada.
7. Atualiza `whatsapp_meta_config.last_webhook_at` como heartbeat — assim a tela de Configurações > Integrações reflete o tráfego real via Chatwoot em vez de mostrar 05/04/26.

UI já estava pronta antes (`src/components/eventos/chat-ia/ChatPanel.tsx` linhas 514-518): bolha mostra `✓` para `enviada`, `✓✓` para `entregue`, `✓✓` azul para `lida`, `✗` para `erro`, `⏳` para `enviando`. Realtime em `whatsapp_mensagens` (linhas 119-138) propaga o UPDATE sem refresh.

Dados retroativos: as 31 saídas presas em `enviada` no dia do deploy NÃO são corrigidas — a janela do Chatwoot para esses message_ids antigos já passou. A partir do deploy, toda mensagem nova segue o caminho correto.

Caso de validação: contato `5521969728370` (Fabio, 09/06/26) — antes do fix, 6 saídas presas em `enviada` com `delivered_at=NULL` e `read_at=NULL`.

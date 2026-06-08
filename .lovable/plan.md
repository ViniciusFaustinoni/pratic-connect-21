
# Confirmação de leitura — Chat IA do Relacionamento

Implementar os dois lados do recibo de leitura no `/eventos/chat-ia`:

1. **Saída (✓✓ azul nas nossas mensagens)**: garantir que `whatsapp_mensagens.status='lida'` + `read_at` chegue à UI em tempo real e os ✓✓ pintem de azul quando o cliente lê no WhatsApp dele.
2. **Entrada (operador → cliente)**: quando o operador rola e a mensagem do cliente fica visível na viewport, disparar `markAsRead` na Evolution/Meta para o cliente ver ✓✓ azul no aparelho dele.

A UI já renderiza ✓✓ baseado em `msg.status` (`ChatPanel.tsx:481`) e os webhooks (`whatsapp-webhook` MESSAGES_UPDATE 4=READ e `whatsapp-meta-webhook` statuses=read) já gravam `status='lida'` + `read_at`. Falta: realtime no painel para refletir a mudança sem reload, e o lado inbound (markAsRead) que hoje não existe.

---

## 1. Saída — realtime de status

Hoje o `ChatPanel` carrega o histórico via `useWhatsAppHistorico`/query e não escuta `UPDATE` em `whatsapp_mensagens` para a conversa aberta. Resultado: ✓✓ azul só aparece depois de refresh manual.

- Adicionar um subscribe Realtime em `ChatPanel.tsx` (ou hook dedicado `useWhatsAppMensagensRealtime(telefone)`) com canal por `telefone` filtrando `event:'UPDATE'` em `public.whatsapp_mensagens` e fazendo `queryClient.setQueryData` na chave do histórico para mesclar `status`/`read_at`/`delivered_at`/`sent_at` por `message_id`.
- Throttle leve (mesma técnica do `useCotacoesRealtime`) para não invalidar a query inteira a cada ACK.
- Garantir que a tabela está em `supabase_realtime` publication e tem `replica identity full` (migração se faltar) — sem isso o subscribe não recebe os UPDATEs.

## 2. Entrada — markAsRead disparado por viewport

### Edge function nova: `whatsapp-mark-read`
- Body: `{ instancia_id, telefone, message_ids: string[] }`.
- Resolve a instância (Evolution × Meta oficial) lendo `whatsapp_instancias` igual aos outros edges.
- **Evolution**: `POST /chat/markMessageAsRead/{instance}` com `read_messages: [{ remoteJid, fromMe:false, id }]`.
- **Meta oficial**: para cada `message_id` do cliente, `POST https://graph.facebook.com/v20.0/{phone_number_id}/messages` com `{ messaging_product:"whatsapp", status:"read", message_id }`.
- Idempotência: ignora `message_ids` que já estão em `whatsapp_mensagens` com `direcao='entrada'` E `lida_pelo_operador_em IS NOT NULL` (campo novo, ver §3).
- Loga em `whatsapp_logs` com `evento:'mark_read'` + ids; erros não bloqueiam (best-effort por mensagem).
- Auth: valida JWT em código (padrão dos outros edges) e checa se o usuário tem acesso ao módulo Relacionamento.

### Migração mínima
- Adicionar coluna `lida_pelo_operador_em timestamptz` em `whatsapp_mensagens` (não afeta o status canônico do WhatsApp; só evita re-disparo). Sem novas tabelas.
- Conferir `alter publication supabase_realtime add table whatsapp_mensagens` + `alter table whatsapp_mensagens replica identity full` (se não estiverem aplicados).

### UI — hook `useMarkMessagesRead`
- No `ChatPanel.tsx`, observar as bolhas de mensagem de `entrada` ainda sem `lida_pelo_operador_em` com `IntersectionObserver` (threshold 0.6).
- Bufferiza ids vistos por 800ms e dispara um único `supabase.functions.invoke('whatsapp-mark-read', { body: { instancia_id, telefone, message_ids }})`.
- Dispara também quando a janela ganha foco (`visibilitychange`/`focus`) e tem msgs pendentes — cobre o caso de operador já estar com a conversa aberta quando chega mensagem nova.
- Botão manual "Marcar lidas" continua funcionando: além do `last_read_at` local que já existe, agora também chama o mesmo edge com os ids não-lidos.
- Não dispara quando a IA estiver no controle (`whatsapp_ia_pausas`/`status='atendimento_humano'` é irrelevante aqui — markAsRead é só do operador humano olhando o chat).

## 3. Detalhes técnicos

- Tabela `whatsapp_mensagens` já tem `status`, `sent_at`, `delivered_at`, `read_at`, `direcao`, `message_id`, `instancia_id`. Reaproveitar.
- A coluna `read_at` representa "lida pelo destinatário no WhatsApp" (saída). Para o lado inbound, usar `lida_pelo_operador_em` para não misturar semântica.
- Webhooks atuais já cobrem saída: `whatsapp-webhook` MESSAGES_UPDATE status 4 e `whatsapp-meta-webhook` statuses `read`. Não mexer.
- Evolution `markMessageAsRead` precisa do `remoteJid` (telefone com `@s.whatsapp.net`) — montar a partir de `telefone`.
- Meta oficial: ler `phone_number_id` da `whatsapp_meta_config`/instância como já feito em `whatsapp-send-text`.

## 4. Arquivos tocados

```text
supabase/functions/whatsapp-mark-read/index.ts           [NOVO]
supabase/migrations/<ts>_whatsapp_mark_read.sql          [NOVO] coluna + realtime
src/components/eventos/chat-ia/ChatPanel.tsx             [edit] subscribe + IO
src/hooks/useWhatsAppMensagensRealtime.ts                [NOVO]
src/hooks/useMarkMessagesRead.ts                         [NOVO]
src/components/eventos/chat-ia/ConversasList.tsx         [edit] botão "Marcar lidas" também chama o edge
src/pages/eventos/EventosChatIA.tsx                      [edit] passa instancia_id ao panel/lista
```

## 5. Fora de escopo

- Recibo entre operadores internos (avatares de quem leu) — não pedido.
- Mudanças no agente IA / `agente-consultor-ia` / pausas — markAsRead é puramente humano.
- Mudanças na renderização do ✓✓ (já existe).

## 6. Saneamento (não-bloqueante, opcional)

- Backfill: `update whatsapp_mensagens set status='lida', read_at=updated_at where direcao='saida' and status in ('enviada','entregue') and updated_at > now() - interval '30 days'` — **NÃO executar**; o realtime + webhook vai cobrir daqui pra frente. Listar como débito caso o usuário queira limpar o histórico visual.

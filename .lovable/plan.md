## Diagnóstico

A UI já está pronta: em `src/components/eventos/chat-ia/ChatPanel.tsx` (linhas 514-518) a bolha renderiza `✓✓` quando `msg.status` é `'lida'` ou `'entregue'`, `✓` quando `'enviada'`, `⏳` quando `'enviando'` e `✗` quando `'erro'`. O Realtime já está assinando `whatsapp_mensagens` (linhas 119-138) e dispara `refetch()` em qualquer UPDATE da linha — então, se o `status` mudar, a bolha vira `✓✓` na hora, sem refresh manual.

O problema é que o `status` nunca muda. Evidência do banco (últimas 24h, `direcao='saida'`):

| status | total |
|---|---|
| `enviada` | 31 |
| `entregue` | 0 |
| `lida` | 0 |
| `erro` | 1 |

E para o contato da imagem (Fabio Brasil, `5521969728370`) as 6 mensagens enviadas hoje estão todas em `status='enviada'`, `delivered_at=NULL`, `read_at=NULL`.

### Por que o status não muda

Dois caminhos de webhook existem no projeto:

1. **`supabase/functions/whatsapp-meta-webhook/index.ts`** (linhas 1086-1103) — tem o handler de `statuses` (`sent → enviada`, `delivered → entregue`, `read → lida`, `failed → erro`) e funcionaria perfeitamente **se** a Meta estivesse chamando essa URL. Mas a telemetria em `whatsapp_meta_config.last_webhook_at = 2026-04-05 01:37:33` mostra que o último evento Meta direto chegou em 5 de abril. Há mais de 2 meses ninguém liga nesse endpoint — a Meta foi reapontada para o Chatwoot quando o Chatwoot virou o barramento.

2. **`supabase/functions/chatwoot-webhook/index.ts`** — recebe os eventos do Chatwoot. Hoje só processa `message_created` (linha 37). Qualquer outro evento, inclusive `message_updated` que é exatamente o que o Chatwoot emite quando o WhatsApp confirma `delivered` / `read`, cai no early-return das linhas 38-42 ("Evento X ignorado") sem efeito.

Confirmação adicional pelos `message_id` no banco:

- Saídas têm `message_id = wamid.HBgN...` (sem prefixo) — foram inseridas pelo `whatsapp-send-text` chamando a Meta API direto.
- Entradas têm `message_id = chatwoot_wamid.HBgN...` — foram inseridas pelo `chatwoot-webhook` com prefixo, mesmo "wamid" base depois do `chatwoot_`.

Ou seja: a saída sai pela Meta direto, a entrada chega via Chatwoot, e o status delivered/read da saída precisa entrar pelo Chatwoot porque é quem está assinado na Meta hoje.

## Plano de correção

### 1. Adicionar branch `message_updated` no `chatwoot-webhook`

Editar `supabase/functions/chatwoot-webhook/index.ts` para, além de `message_created`, reconhecer `message_updated`. Quando entrar `message_updated`:

- Ler `payload.messages?.[0].status` (Chatwoot expõe `sent` / `delivered` / `read` / `failed`).
- Ler `payload.messages?.[0].source_id` — esse é o `wamid` da Meta.
- Mapear com o mesmo dicionário canônico já usado em `whatsapp-meta-webhook`:
  `sent → enviada`, `delivered → entregue`, `read → lida`, `failed → erro`.
- Fazer `UPDATE whatsapp_mensagens SET status = <novo>, updated_at = now()` filtrando por `message_id IN (source_id, 'chatwoot_' || source_id)` — cobre tanto as saídas Meta-diretas (`wamid…`) quanto eventuais saídas/entradas com prefixo (`chatwoot_wamid…`).
- Não regredir status: nunca sobrescrever `'lida'` com `'entregue'` nem `'entregue'` com `'enviada'` (defesa contra eventos fora de ordem). Implementar com `WHERE status NOT IN (...)` correspondente ao nível atingido.
- Preencher os timestamps quando disponíveis: `delivered_at = now()` em `delivered`, `read_at = now()` em `read`. Esses campos já existem em `whatsapp_mensagens` (confirmado pelo SELECT inicial).
- Logar `[chatwoot-webhook] status update {source_id} → {novo_status} ({linhas_afetadas} linhas)` para diagnóstico.
- Não enfileirar IA em `message_updated` (a fila é só para `message_created` de entrada).

Mantém o handler existente de `message_created` exatamente como está; nenhuma alteração na inserção de mensagens nem no caminho da Maya.

### 2. Manter Meta direto como caminho secundário (sem mudar nada)

O handler `statuses` em `whatsapp-meta-webhook/index.ts` (linhas 1086-1103) já está correto. Não é apagado — fica de fallback caso a Meta volte a apontar para essa URL no futuro ou a config seja restaurada. Nenhuma alteração de código necessária aqui.

### 3. Telemetria mínima

Atualizar `whatsapp_meta_config.last_webhook_at` / `last_webhook_event` quando o `chatwoot-webhook` receber um `message_updated` válido — mesma tabela já é usada como heartbeat. Assim a tela de Configurações > Integrações deixa de mostrar "último webhook 05/04" e passa a refletir o tráfego real via Chatwoot.

### 4. Validação após deploy

1. Abrir o chat do Fabio (`(21) 96972-8370`) em Eventos > Chat IA.
2. Enviar uma mensagem manual pelo painel.
3. Esperar 1-5s. A bolha deve mostrar `✓` (enviada) e em seguida `✓✓` (entregue) quando o aparelho do cliente receber.
4. Quando o cliente abrir a conversa no WhatsApp, `✓✓` deve ficar azul (`status='lida'`).
5. Conferir em `supabase` query rápida:
   ```sql
   select status, delivered_at, read_at, message_id
   from whatsapp_mensagens
   where telefone='5521969728370' and direcao='saida'
   order by created_at desc limit 5;
   ```
   Os campos `delivered_at` / `read_at` precisam aparecer preenchidos.
6. Conferir `whatsapp_meta_config.last_webhook_at` — deve passar a atualizar a cada evento Chatwoot.

### Memória canônica

Gravar `mem://logic/integrations/chatwoot-webhook-status-updates` registrando: Chatwoot é o barramento atual; status delivered/read entram via `chatwoot-webhook` no evento `message_updated`; matching por `source_id` cobre `wamid…` e `chatwoot_wamid…`; sem regressão de status; meta-webhook segue como fallback inativo. Atualizar entrada de `mem://infrastructure/whatsapp/messaging-safety-and-idempotency` apontando para essa nova canônica.

## Detalhes técnicos

Arquivos editados:
- `supabase/functions/chatwoot-webhook/index.ts` — adicionar branch `message_updated` com mapeamento de status, UPDATE protegido contra regressão, preenchimento de `delivered_at` / `read_at`, log estruturado e atualização de telemetria.

Arquivos NÃO tocados (importante):
- `src/components/eventos/chat-ia/ChatPanel.tsx` — render ✓/✓✓ já correto, mantém.
- `supabase/functions/whatsapp-meta-webhook/index.ts` — handler de `statuses` permanece como fallback.
- `supabase/functions/whatsapp-send-text/index.ts` — caminho de envio direto na Meta não muda.
- `src/hooks/useWhatsAppHistorico.ts` — leitura segue igual; o Realtime já cuida da propagação.

Não há migração de banco — `whatsapp_mensagens.delivered_at` e `read_at` já existem.

Não há mudança na fila da IA, nem no `useMarkMessagesRead` (que cuida da leitura no sentido **inverso**: marca como lidas no provedor as mensagens de entrada que o operador viu).

Nenhum dado retroativo será corrigido — as 31 saídas presas em `enviada` permanecem assim porque a janela do Chatwoot para esses message_ids antigos já passou. A partir do deploy, toda mensagem nova segue o caminho correto.

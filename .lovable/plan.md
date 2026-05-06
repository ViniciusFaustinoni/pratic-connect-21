## Contexto importante (já existe)

Quase tudo que você descreveu **já está implementado** em `src/pages/eventos/EventosChatIA.tsx` (rota `/eventos/chat-ia`, atualmente dentro do menu **Eventos** como "Chat IA"):

- Layout WhatsApp Web (lista de conversas à esquerda, painel à direita) — `ConversasList.tsx` + `ChatPanel.tsx`
- Rolagem automática da conversa aberta
- Clique na conversa abre o painel à direita
- Envio humano de **texto e áudio** já funciona (`whatsapp-send-text`, `whatsapp-send-media`)
- Realtime via `whatsapp_mensagens` já ligado
- Avatar do associado já é casado por telefone

**Conforme regra do projeto, vou apenas mover/renomear e completar o que falta — não recriar do zero.**

## O que falta (e será implementado)

1. Mover/expor o item no menu **Relacionamento** como **"Chat"** (mantendo a rota `/eventos/chat-ia` por compat — ou criando alias `/relacionamento/chat`).
2. Filtrar conversas pelo **provedor ativo** (instância WhatsApp principal/ativa) usando a coluna `whatsapp_mensagens.provedor` + `whatsapp_instancias` (`ativa = true`).
3. Adicionar **envio de arquivos/imagens** ao input do `ChatPanel` (hoje só texto + áudio).
4. Tornar o nome do contato no header do chat **clicável** → abre drawer com detalhes do associado (foto, nome, telefone, planos, link "Abrir cadastro completo").
5. **Pausa da IA por 10 minutos** após intervenção humana no chat (contados da última mensagem humana enviada).
6. **Botão "Encerrar atendimento"** no drawer de detalhes: envia mensagem amigável de encerramento (texto livre, sem template) e reduz a pausa para **1 minuto**.

## Mudanças no banco

Nova tabela leve para controlar pausa por telefone:

```sql
create table public.whatsapp_ia_pausas (
  telefone text primary key,
  pausada_ate timestamptz not null,
  motivo text not null check (motivo in ('intervencao_humana','encerramento_atendimento')),
  atendente_id uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_ia_pausas enable row level security;
-- policies: SELECT/INSERT/UPDATE para usuários internos autenticados
```

Edge function `processar-fila-ia` passa a checar `whatsapp_ia_pausas.pausada_ate > now()` antes de responder; se pausada, ignora o item da fila (mas mantém a mensagem registrada).

## Mudanças no frontend

**Sidebar (`src/components/layout/AppSidebar.tsx`)**
- Remover "Chat IA" de Eventos (ou manter por compat, a confirmar — ver pergunta abaixo).
- Adicionar item **"Chat"** em Relacionamento, ícone `MessageCircle`, url `/eventos/chat-ia`.
- Atualizar `GlobalBreadcrumb.tsx` para refletir o caminho.

**`src/pages/eventos/EventosChatIA.tsx`**
- Buscar `whatsapp_instancias` ativa(s) e filtrar `whatsapp_mensagens` por `provedor` correspondente (ou `instancia_id`).

**`src/components/eventos/chat-ia/ChatPanel.tsx`**
- Adicionar botão de anexo (paperclip) → upload → `whatsapp-send-media` (já existe).
- Tornar o nome do contato no header um botão → abre `ContatoDetalheDrawer`.
- Após `handleEnviar` de texto/áudio/mídia humana: `upsert` em `whatsapp_ia_pausas` com `pausada_ate = now() + 10 min`.
- Mostrar badge "IA pausada até HH:mm" no header quando ativa.

**Novo `src/components/eventos/chat-ia/ContatoDetalheDrawer.tsx`**
- Busca associado por telefone (já há lookup similar em `EventosChatIA.tsx`).
- Mostra avatar, nome, telefone, status, link "Abrir cadastro" (`/cadastro/associados/:id`).
- Botão **"Encerrar atendimento"**: abre dialog com textarea (mensagem padrão pré-preenchida do tipo "Foi um prazer atendê-lo! Qualquer dúvida, estamos por aqui. 🙏"), envia via `whatsapp-send-text` e faz upsert em `whatsapp_ia_pausas` com `pausada_ate = now() + 1 min` e `motivo = 'encerramento_atendimento'`.

## Detalhes técnicos

- A pausa é por **telefone (E.164 com DDI 55)**, não por conversa, para casar com o webhook.
- O cron `processar-fila-ia` checa pausa antes de responder; mensagens entrantes continuam sendo gravadas normalmente.
- Mensagem de encerramento é texto livre — **não usa template** (conforme requisito 9).
- Filtro de provedor ativo: como hoje só há 1 instância (`Principal`, ativa), o filtro é por `instancia_id` da instância `ativa = true AND principal = true`.

## Pergunta pendente

Se preferir, posso te perguntar antes de implementar: **manter "Chat IA" em Eventos** (duplicando o acesso) **ou removê-lo** dali, deixando o "Chat" só em Relacionamento? Default: **mover** (remover de Eventos).

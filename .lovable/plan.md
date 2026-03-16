

# Tela de Chat IA no módulo Eventos

## Objetivo
Criar uma tela completa estilo WhatsApp Web dentro do módulo Eventos (`/eventos/chat-ia`), mostrando todas as conversas da IA Maya com associados/usuários. Layout split: lista de conversas à esquerda, chat à direita.

## Estrutura

```text
┌──────────────────────────────────────────────────────┐
│  /eventos/chat-ia                                     │
├──────────────┬───────────────────────────────────────┤
│  🔍 Buscar   │  [Header: Nome + Foto + Telefone]    │
│──────────────│───────────────────────────────────────│
│  👤 João     │  ┌─────────┐                          │
│  Última msg  │  │ Bolha   │  (mensagem IA)           │
│  12:30       │  └─────────┘                          │
│──────────────│                    ┌─────────┐        │
│  👤 Maria    │                    │ Bolha   │ (user) │
│  Olá, prec.. │                    └─────────┘        │
│  Ontem       │                                       │
│──────────────│  🎤 [Gravar] [    Input     ] [Enviar]│
└──────────────┴───────────────────────────────────────┘
```

## Funcionalidades
- **Lista lateral**: Busca conversas agrupadas por telefone, mostra avatar do associado (consulta `associados` por telefone/whatsapp), nome, prévia da última mensagem, horário
- **Chat principal**: Mensagens com auto-scroll, markdown para IA, balões estilo WhatsApp
- **Enviar com Enter** (Shift+Enter para nova linha)
- **Gravação de áudio**: Botão de mic, grava via MediaRecorder, envia para transcrição e depois como mensagem
- **Reprodução de áudio**: Mensagens tipo `audio` renderizam player HTML5 `<audio>` com `media_url`
- **Realtime**: Supabase Realtime na tabela `whatsapp_mensagens` para atualizar a conversa aberta
- **Fotos de perfil**: Busca `avatar_url` dos associados vinculando por telefone

## Arquivos

### Novo: `src/pages/eventos/EventosChatIA.tsx`
Página principal com layout split. Lista de conversas à esquerda usando query em `whatsapp_mensagens` agrupada por telefone (similar ao `WhatsAppConversasPainel` existente). Chat à direita com as mensagens do telefone selecionado.

### Novo: `src/components/eventos/chat-ia/ConversasList.tsx`
Componente da lista lateral com:
- Busca por nome/telefone
- Avatar do associado (query join com `associados` por telefone)
- Nome, prévia, horário relativo
- Indicador de não lidas

### Novo: `src/components/eventos/chat-ia/ChatPanel.tsx`
Painel de chat com:
- Header com nome e avatar
- Área de mensagens com auto-scroll
- Renderização de markdown (IA) e texto puro (user)
- Player de áudio para mensagens tipo `audio`
- Input com Enter para enviar + botão de gravação de áudio
- Realtime subscription para mensagens novas

### Editar: `src/components/layout/AppSidebar.tsx`
Adicionar item "Chat IA" ao menu de Eventos (com ícone `MessageSquare`).

### Editar: `src/App.tsx`
Adicionar rota `/eventos/chat-ia`.

### Editar: `src/components/layout/GlobalBreadcrumb.tsx`
Adicionar breadcrumb para a nova rota.

## Detalhes técnicos

**Envio de mensagens**: Invoca `supabase.functions.invoke('whatsapp-send-text')` com telefone e mensagem para enviar via WhatsApp ao associado.

**Gravação de áudio**: Usa `MediaRecorder` API (já implementado em `ChatInput.tsx`). O áudio gravado pode ser enviado como mídia via edge function.

**Reprodução de áudio**: Mensagens com `tipo === 'audio'` e `media_url` renderizam `<audio controls src={media_url} />`.

**Realtime**: Subscribe em `whatsapp_mensagens` filtrando por telefone selecionado para atualizar mensagens instantaneamente.

**Avatar dos associados**: Query separada buscando `associados.avatar_url` e `nome` por telefone/whatsapp matching com os telefones das conversas.


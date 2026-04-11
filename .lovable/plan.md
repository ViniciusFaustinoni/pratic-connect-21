

## Plano: Chat IA no menu Relacionamento

### Contexto
A pagina `EventosChatIA` ja existe com layout WhatsApp (conversas a esquerda, chat a direita), usando `whatsapp_mensagens` e mostrando todas as conversas com a Maya IA. O usuario quer essa mesma funcionalidade acessivel via menu "Relacionamento" (grupo `cobranca`).

### Alteracoes

**1. `src/components/layout/AppSidebar.tsx`**
- Adicionar item `{ title: 'Chat', url: '/cobranca/chat', icon: MessageCircle }` no grupo `cobranca` (Relacionamento)

**2. `src/App.tsx`**
- Adicionar rota `/cobranca/chat` apontando para `EventosChatIA` (reutilizar o mesmo componente)

**3. `src/components/layout/GlobalBreadcrumb.tsx`**
- Adicionar entrada `'/cobranca/chat': { label: 'Chat' }`

### Resultado
O mesmo componente de chat ja funcional (conversas agrupadas por telefone, mensagens enviadas/recebidas, audios, imagens, markdown, realtime) ficara acessivel tanto em `/eventos/chat-ia` quanto em `/cobranca/chat`.

### Arquivos
- **Editar**: `src/components/layout/AppSidebar.tsx` (1 linha)
- **Editar**: `src/App.tsx` (1 rota)
- **Editar**: `src/components/layout/GlobalBreadcrumb.tsx` (1 linha)


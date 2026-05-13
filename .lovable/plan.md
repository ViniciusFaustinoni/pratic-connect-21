## Objetivo
Disponibilizar um item **Chat** no módulo Monitoramento (sidebar laranja), reusando o chat unificado já existente em `/eventos/chat-ia` (`EventosChatIA`), porém filtrando a lista de conversas para mostrar somente associados/contatos relevantes à operação de Monitoramento.

## Mudanças

### 1. Nova variante do chat
Arquivo: `src/pages/eventos/EventosChatIA.tsx`
- Estender o tipo `drawerVariant` para `'relacionamento' | 'eventos' | 'monitoramento'`.
- Adicionar prop opcional `escopo?: 'todos' | 'monitoramento'` (default `'todos'`).
- Quando `escopo === 'monitoramento'`, filtrar a lista de telefones exibidos para conversas cujo telefone pertence a um associado com pelo menos uma das condições:
  - veículo com `status` em `('ativo','instalacao_pendente','suspenso_nao_instalacao','manutencao')`, OU
  - serviço aberto em `servicos` (instalação, vistoria, retirada, manutenção, base, rota), OU
  - rastreador vinculado em `rastreadores.veiculo_id`.
- Filtro feito client-side após carregar `mensagens` + cruzando com nova query `useQuery(['monitoramento-telefones-elegiveis'])` que busca uma vez (cache 60s) os telefones a partir de `associados` join com `veiculos` e `servicos` abertos.

### 2. Página wrapper de Monitoramento
Novo: `src/pages/monitoramento/MonitoramentoChat.tsx`
```tsx
import EventosChatIA from '../eventos/EventosChatIA';
export default function MonitoramentoChat() {
  return <EventosChatIA drawerVariant="monitoramento" escopo="monitoramento" />;
}
```

### 3. Rota
Arquivo: `src/App.tsx`
- Adicionar lazy import e `<Route path="/monitoramento/chat" element={<MonitoramentoChat />} />` (dentro do mesmo wrapper protegido das demais rotas de monitoramento).

### 4. Item de menu
Arquivo: `src/components/layout/AppSidebar.tsx`
- Inserir no array `items` do bloco `id: 'monitoramento'`:
  ```ts
  { title: 'Chat', url: '/monitoramento/chat', icon: MessageCircle },
  ```
  posicionado logo após "Equipe" (ou antes de "Aprovações", à definir visualmente).

### 5. Breadcrumb
Arquivo: `src/components/layout/GlobalBreadcrumb.tsx`
- Adicionar `'/monitoramento/chat': { label: 'Chat' }`.

### 6. Drawer de contato
O `ChatPanel` já recebe `drawerVariant`. Garantir que `'monitoramento'` recaia em um drawer focado em dados operacionais (rastreador, último serviço, veículo). Se o componente atual não diferenciar, manter fallback igual ao `'eventos'`/`'relacionamento'` para esta primeira entrega e iterar depois conforme feedback.

## Pontos não incluídos (escopo deliberado)
- Não duplicar tabelas nem fluxos de mensagem; é mesmo backend (Evolution/Meta + `whatsapp_mensagens`) com filtro de visualização.
- Não alterar permissões: respeita `canManageInstalacoes` do módulo.
- Não tocar no edge function `agente-consultor-ia`.

## Validação
1. Login como diretor (`admin@teste.com`).
2. Conferir item "Chat" na sidebar Monitoramento.
3. Acessar `/monitoramento/chat`: ver apenas conversas de associados com veículo/serviço/rastreador ativos.
4. Comparar com `/eventos/chat-ia` — este continua exibindo todas.
5. Enviar/receber mensagem em uma conversa filtrada para confirmar realtime e persistência idênticos ao Relacionamento.

## Problema

No `ChatPanel` (Eventos › Chat IA), a conversa abre rolada para o topo e nem sempre acompanha mensagens novas em tempo real, mesmo a Realtime já estando ligada.

**Causa raiz:** o `scrollRef` está aplicado no componente `<ScrollArea>` do shadcn (wrapper), mas quem realmente rola é o viewport interno do Radix (`[data-radix-scroll-area-viewport]`). Assim, `scrollTop = scrollHeight` é aplicado no elemento errado e não tem efeito.

A subscription Realtime em `whatsapp_mensagens` já existe e dispara `refetch()` — só não aparece porque a rolagem não acompanha.

## O que vai mudar (somente UI do ChatPanel)

1. **Resolver o viewport correto do ScrollArea**
   - Trocar o alvo do `scrollRef` para o viewport interno do Radix via `querySelector('[data-radix-scroll-area-viewport]')` (ou ref via callback).
   - Criar helper `scrollToBottom(behavior)` reutilizado em todos os pontos que hoje fazem `scrollRef.current.scrollTop = scrollHeight` (auto-scroll, envio manual, etc.).

2. **Rolagem inicial no final ao abrir a conversa**
   - Ao carregar a primeira página de mensagens (transição `isLoading=false` + `mensagens.length>0`) e ao trocar de `telefone`, forçar `scrollToBottom('auto')` (sem animação) em um próximo tick para garantir que o layout já mediu altura.
   - Resetar a flag `autoScroll = true` sempre que o `telefone` muda.

3. **Auto-scroll em tempo real, respeitando intenção do usuário**
   - Detectar se o usuário está "colado no fim" via listener de `scroll` no viewport (`scrollTop + clientHeight >= scrollHeight - 80`). Atualiza `autoScroll` em tempo real.
   - Em novas mensagens (mudança de `mensagens` ou de `pendingMessages`): se `autoScroll`, rolar suave para o fim; se não, mostrar um pequeno botão flutuante "↓ novas mensagens" que aparece quando chegam mensagens e o usuário rolou para cima.

4. **Garantia da Realtime**
   - Manter a subscription atual. Acrescentar `event: '*'` apenas para UPDATE de status (entregue/lido) sem mexer em lógica de negócio, para que ticks de leitura também apareçam ao vivo. Continua `refetch()` apenas — sem cache manual.

## Fora do escopo

- Nenhuma mudança em edge functions, agente IA, transbordo, CPF gate ou banco.
- Não mexer no painel de conversas (esquerda) — pedido é só a tela de conversa.

## Arquivos

- `src/components/eventos/chat-ia/ChatPanel.tsx` (única alteração)

## Critérios de aceite

- Abrir qualquer conversa: já aparece rolada na última mensagem, sem "pulo" visível.
- Trocar de contato: idem.
- Receber mensagem nova (cliente ou Maya) com a conversa aberta no fim: rola suave automaticamente.
- Usuário rolou para ler histórico: NÃO é arrastado para baixo; vê botão "↓ novas mensagens" quando chega algo novo; clicar leva ao fim.
- Enviar mensagem: rola para o fim imediatamente.

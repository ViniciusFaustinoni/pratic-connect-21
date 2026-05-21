## Objetivo

Aplicar a direção **"Faded edge navigation"** escolhida pelo usuário na barra de abas do modal de detalhes em **Monitoramento › Serviços de Campo**, deixando a navegação mais fluida sem remover nem esconder nenhuma funcionalidade.

## Regras respeitadas

- Todas as 10 abas continuam visíveis e clicáveis (Resumo, Cliente & Veículo, Endereço, Retirada*, Rastreador*, Documentos, Fotos, Financeiro, Histórico, Timeline) — `*` continuam condicionais como hoje.
- Nenhum botão de ação (Ficha do associado, WhatsApp, Rota no Maps, Realocar, Cancelar) é tocado.
- Apenas refino visual da `TabsList` — sem mudança de lógica, hooks ou comportamento.
- Tokens semânticos do design system (`bg-background`, `border-b`) — sem cor hardcoded.

## O que muda

Arquivo único: **`src/components/servicos-campo/ServicoDetailModal.tsx`** (linhas 252–265).

1. Envolver a `TabsList` em um wrapper `relative` com dois gradientes de fade (`from-background to-transparent`) sobrepostos nas bordas esquerda e direita — sinaliza visualmente que há conteúdo rolável sem mostrar barra de scroll do SO.
2. Esconder a scrollbar nativa horizontal (`[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`) e habilitar `scroll-smooth` para rolagem suave por trackpad / shift+scroll.
3. Aplicar `shrink-0` em cada `TabsTrigger` para garantir que os rótulos nunca sejam comprimidos.
4. Mover o `px-6` do wrapper externo para a própria `TabsList` para que os fades cubram a borda real do conteúdo, não o padding.

## Fora de escopo

- Não troca de paleta, fonte, ícones ou ordem das abas.
- Não esconde rótulos atrás de ícones (a direção escolhida mantém label sempre visível).
- Não mexe nos `TabsContent` nem nos botões de ação acima.

Pronto para implementar assim que sair do modo de planejamento.

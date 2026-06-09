## Problema
No `/relacionamento` chat, em telas mobile, os balões de mensagem extrapolam a largura visível e o texto fica cortado à direita. O `max-w-[75%]` definido em `ChatPanel.tsx` não está sendo respeitado.

## Causa raiz
O `ScrollAreaPrimitive.Viewport` do Radix gera internamente um wrapper com `display: table; min-width: 100%`. Como o filho direto é uma tabela, larguras percentuais (`max-w-[75%]`, `max-w-full`) passam a ser calculadas em relação à largura intrínseca do conteúdo, não à viewport. Textos longos esticam o "table" para além da largura do container e são cortados pelo `overflow-hidden` do Root. No desktop sobra espaço e o defeito não aparece.

## Correção (escopo mínimo, só UI mobile)
Forçar o wrapper interno do Viewport a se comportar como bloco com largura 100%, sem mexer em mais nada.

**Arquivo:** `src/components/ui/scroll-area.tsx`
- No `ScrollAreaPrimitive.Viewport`, adicionar classes utilitárias que sobrescrevem o estilo inline do Radix no filho direto:
  - `[&>div]:!block [&>div]:!w-full [&>div]:!min-w-0`

Isso resolve em todos os usos do `ScrollArea` no app — incluindo o `ChatPanel` — sem alterar lógica nem outros componentes.

## Validação
- Abrir `/relacionamento` no mobile (375px): balões respeitam `max-w-[75%]`, texto quebra com `break-words` em vez de cortar.
- Desktop continua idêntico (largura já sobrava).
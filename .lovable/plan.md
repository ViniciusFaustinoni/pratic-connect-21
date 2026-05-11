## Converter "Detalhes da Troca" de drawer para modal

Hoje `src/components/cotacoes/TrocaTimelineDrawer.tsx` usa `Sheet` lateral. Vou trocar para `Dialog` (modal centralizado), preservando todo o conteúdo (cabeçalho, status do termo, timeline, alertas).

### Mudança única em `TrocaTimelineDrawer.tsx`
- Substituir `Sheet/SheetContent/SheetHeader/SheetTitle` por `Dialog/DialogContent/DialogHeader/DialogTitle` (`@/components/ui/dialog`).
- `DialogContent` com `className="max-w-lg max-h-[85vh] overflow-y-auto"` para manter rolagem e largura semelhante ao drawer atual.
- Mantém o nome do componente e a assinatura de props (`open`, `onOpenChange`, etc.) para não quebrar o `OutrosProcessosPanel.tsx`.

### Fora de escopo
- Não renomear o arquivo nem o componente (evita refactor em chamadas).
- Sem mudanças visuais no conteúdo, só no container.
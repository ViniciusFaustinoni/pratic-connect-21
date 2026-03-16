

# Fix: Filtro Manual de Cotação (SearchableSelect dentro de Dialog)

## Problema

O `SearchableSelect` (Popover + Command) dentro do `Dialog` de cotação rápida tem problemas de interação. O Popover renderiza seu conteúdo via Portal (fora do DOM do Dialog), causando conflitos com o comportamento modal do Dialog do Radix:

- Ao clicar num item do dropdown, o Dialog interpreta como "clique fora" e fecha
- A gestão de foco entre Dialog e Popover interfere na seleção de itens
- O resultado é que o consultor não consegue completar a seleção de marca/modelo/ano

## Solução

### 1. Prevenir fechamento do Dialog ao interagir com Popovers

No `CotacaoFormDialog.tsx`, adicionar `onPointerDownOutside` e `onInteractOutside` ao `DialogContent` para impedir que cliques em conteúdo portalizado (dropdowns) fechem o Dialog:

```tsx
<DialogContent
  className="max-w-3xl max-h-[90vh] overflow-y-auto"
  onPointerDownOutside={(e) => e.preventDefault()}
  onInteractOutside={(e) => e.preventDefault()}
>
```

Isso é seguro porque o Dialog já tem botão X e botão Cancelar para fechar.

### 2. Melhorar SearchableSelect para contexto de Dialog

No `searchable-select.tsx`, adicionar `modal={false}` ao Popover para desativar o comportamento modal do próprio Popover (que também pode capturar foco indevidamente):

```tsx
<Popover open={open} onOpenChange={setOpen} modal={false}>
```

E adicionar `onCloseAutoFocus={(e) => e.preventDefault()}` ao `PopoverContent` para evitar que o foco volte ao trigger e dispare re-renders indesejados.

## Arquivos alterados

- `src/components/cotacoes/CotacaoFormDialog.tsx` (1 linha: adicionar props ao DialogContent)
- `src/components/ui/searchable-select.tsx` (2 linhas: modal={false} + onCloseAutoFocus)


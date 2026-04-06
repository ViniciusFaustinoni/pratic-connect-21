

# Plano: Corrigir layout das tabs de planos no Cotador

## Problema
As tabs de planos no card "Resultado da Cotação" usam `flex-1` em um `div flex`, fazendo com que todos os planos se espremam horizontalmente quando há muitos planos. Isso causa o overflow visível na screenshot.

## Solução
Tornar o container das tabs scrollável horizontalmente com `overflow-x-auto` e dar tamanho mínimo fixo a cada tab (`min-w-fit`, `whitespace-nowrap`), removendo `flex-1`.

## Alteração

### `src/pages/vendas/Cotador.tsx`
- Linha 1730: trocar `<div className="flex border-b">` por `<div className="flex border-b overflow-x-auto">`
- Linha 1736: trocar `"flex-1 py-3 px-4 text-sm font-medium..."` por `"shrink-0 py-3 px-4 text-sm font-medium whitespace-nowrap..."` (remover `flex-1`, adicionar `shrink-0 whitespace-nowrap`)

## Arquivo modificado
- `src/pages/vendas/Cotador.tsx`


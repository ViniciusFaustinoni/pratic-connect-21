
# Correção: Design do Modal de Migração

## Problemas identificados (screenshot)

1. **Descrição truncada** — Linhas 294-295 usam `truncate` no título e na descrição do header. A descrição longa ("O cliente está em outra associação e quer vir para a Praticcar sem perder a c...") é cortada.
2. **Scrollbar horizontal** — O conteúdo está transbordando horizontalmente.
3. **Botão X (fechar) sobrepondo conteúdo** — O `DialogContent` tem `p-0` mas o botão X do dialog fica posicionado absolutamente no canto superior direito, conflitando com o header customizado.

## Alterações

### `src/components/vendas/OutrasEntradasMenu.tsx`

1. **Header (linhas 293-296):** Remover `truncate` da descrição (linha 295) e substituir por `line-clamp-2` ou simplesmente deixar o texto fluir. Adicionar `pr-8` ao header para não conflitar com o botão X.
2. **Overflow (linha 282):** Adicionar `overflow-hidden` ao container flex para evitar scrollbar horizontal.

São ajustes de 2-3 linhas de CSS.

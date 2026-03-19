

# Unificar Aprovações FIPE e Elegibilidade em uma única página

## O que muda

As duas páginas separadas — **Aprovações FIPE** (`/vendas/aprovacoes-fipe`) e **Aprovações Elegibilidade** (`/aprovacoes-elegibilidade`) — serão combinadas em uma única página com abas. A página `AprovacoesFipeMenor.tsx` já tem abas internas (FIPE Menor / Alto Valor). Elegibilidade será adicionada como 3ª seção.

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/vendas/AprovacoesFipeMenor.tsx` | Renomear para página unificada "Aprovações". Adicionar 3ª aba "Elegibilidade" que renderiza `PainelAprovacoesElegibilidade`. Atualizar título da página |
| `src/components/layout/AppSidebar.tsx` | Remover item "Aprovações Elegibilidade" separado. Renomear "Aprovações FIPE" → "Aprovações" |
| `src/App.tsx` | Remover rota `/aprovacoes-elegibilidade` (ou redirecionar para `/vendas/aprovacoes-fipe`). Manter rota única |
| `src/components/layout/GlobalBreadcrumb.tsx` | Remover entrada de elegibilidade separada, renomear entrada FIPE → "Aprovações" |
| `src/pages/vendas/AprovacoesElegibilidade.tsx` | Pode ser removido ou mantido como redirect |

A aba "Elegibilidade" reutiliza o componente `PainelAprovacoesElegibilidade` já existente, sem duplicar código.


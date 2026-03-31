

# Remover bloco de carências do Dialog de Cotação Rápida

## Causa raiz
O bloco de carência foi removido do `Cotador.tsx`, mas a tela visível na imagem é o **CotacaoFormDialog.tsx** — um componente diferente que também exibe o mesmo bloco.

## Correção
- **Arquivo**: `src/components/cotacoes/CotacaoFormDialog.tsx`
- **Ação**: Deletar linhas **2091-2108** (o `{/* Carência */}` com o `<Alert>` azul contendo "Carência geral" e "Carência vidros/faróis")




# Plano: Substituição de veículo com contexto de vendas

## Problema
O `SubstituicaoVeiculoPage` tem breadcrumbs e links hardcoded para `/cadastro/associados`. Quando acessado via `/vendas/substituicao/:associadoId`, os breadcrumbs ainda apontam para cadastro. Além disso, o usuário está acessando a rota antiga `/cadastro/associados/:id/substituicao` -- é necessário garantir que vendedores usem apenas a rota de vendas.

## Alterações

### 1. Detectar contexto de rota no `SubstituicaoVeiculoPage`
- Usar `useLocation()` para verificar se o path começa com `/vendas/`.
- Ajustar breadcrumbs dinamicamente:
  - Contexto vendas: `Home > Vendas > Substituição de Veículo`
  - Contexto cadastro: `Home > Associados > [Nome] > Substituição de Veículo` (atual)
- Botão "Voltar" usa `navigate(-1)` (já funciona corretamente).

### 2. Garantir navegação correta na Cotacao
- Verificar que `Cotacao.tsx` linha 363 já navega para `/vendas/substituicao/` (feito na edição anterior).
- Verificar se há outros pontos que redirecionam vendedores para a rota de cadastro.

## Arquivo modificado
- `src/pages/cadastro/SubstituicaoVeiculoPage.tsx` -- breadcrumbs dinâmicos baseados no contexto de rota


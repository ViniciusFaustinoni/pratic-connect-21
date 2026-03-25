

# Mostrar Planos Desativados em Produtos & Precos

## Problema
O hook `usePlans` filtra `.eq('ativo', true)`, fazendo planos desativados sumirem da lista em "Planos, Produtos e Precos". Na Gestao Comercial, o usuario precisa ver todos os planos (ativos e inativos) para poder reativa-los ou edita-los.

## Solucao
Adicionar um parametro opcional `includeInactive` ao hook `usePlans`. No componente `ProdutosPlanos`, passar `includeInactive: true` para que planos desativados continuem visiveis (com indicador visual de status).

## Alteracoes

### 1. `src/hooks/usePlans.ts`
- Na funcao `usePlans(productLineSlug?, includeInactive?)`: quando `includeInactive` for `true`, remover o filtro `.eq('ativo', true)` da query (manter apenas `visivel_gestao = true`)
- Atualizar a queryKey para incluir o parametro

### 2. `src/components/gestao-comercial/ProdutosPlanos.tsx`
- Passar `includeInactive: true` na chamada de `usePlans`
- Os planos inativos ja possuem badge visual e toggle de ativar/desativar no componente, entao nenhuma alteracao de UI e necessaria

Todos os demais consumidores de `usePlans` (cotacao, calculadora, landing) continuam recebendo apenas planos ativos por padrao.




# Filtrar planos de elegibilidade por `visivel_gestao`

## Problema
As 3 queries de planos na aba de Elegibilidade buscam todos os planos ativos (`eq('ativo', true)`) sem filtrar por `visivel_gestao`. Isso exibe planos internos/derivados (variantes APP, etc.) que não aparecem na aba "Produtos e Planos".

## Solução
Adicionar `.eq('visivel_gestao', true)` nas 3 queries de planos em `ElegibilidadeVeiculos.tsx`:

1. **Linha 97** — query em `TabPorPlano`
2. **Linha 429** — query em `TabImportarArquivo`
3. **Linha 842** — fallback query em `TabResumoGlobal`

Mudança idêntica em cada local: adicionar `.eq('visivel_gestao', true)` após `.eq('ativo', true)`.




## Plano: Corrigir clonagem de regras na duplicacao de linha

### Problema raiz

A funcao `useDuplicateProductLine` tem dois bugs criticos:

1. **Regras truncadas pelo limite de 1000 linhas do Supabase**: As queries nas linhas 1088-1089 buscam TODAS as regras de beneficio (759) e cobertura (2297) do banco inteiro sem filtrar pelos IDs relevantes. Como o Supabase retorna no maximo 1000 linhas por padrao, a maioria das regras (tipo_uso, combustivel, fipe_range) nao e encontrada e portanto nao e clonada.

2. **Ordem de execucao errada**: As queries de regras sao disparadas em paralelo (linha 1084) ANTES de coletar os IDs de beneficios e coberturas (linhas 1097-1106), impossibilitando o uso de filtro `.in('entity_id', ids)`.

### Consequencias visíveis

- Coberturas clonadas mostram apenas a regra de regiao (criada pelo override) — perdem tipo_uso (APP), combustivel (Flex, Gasolina, Etanol)
- Preco exibido como valor fixo (R$ 2,25) em vez de faixa FIPE (R$ 2,50 ~ R$ 45,00) porque as regras `fipe_range` nao foram clonadas

### Correcao

**Arquivo: `src/hooks/usePlansAdmin.ts`**

Reestruturar o fluxo de fetch na funcao `useDuplicateProductLine`:

1. Remover as queries de `benefit_rules`, `cob_rules` e `benefit_category_exclusions` do bloco paralelo inicial (linhas 1084-1091)
2. Mover essas queries para DEPOIS da coleta dos IDs (apos linha 1106), filtrando por `.in('entity_id', benefitIdsArr)` e `.in('entity_id', coberturaIdsArr)`
3. Para listas maiores que 1000 IDs, dividir em chunks de 500 e concatenar resultados (paginacao manual)

```text
Fluxo corrigido:
  1. Fetch line + plans + planos_coberturas + plan_rules  (paralelo)
  2. Coletar benefitIds e coberturaIds dos resultados
  3. Fetch benefit_rules, cob_rules, exclusions filtrados por IDs  (paralelo)
  4. Batch-insert plans, rules, benefits, coberturas  (como hoje)
```

Nenhuma outra alteracao necessaria — a logica de `applyBulkRuleOverrides` ja preserva corretamente as regras de tipos nao sobrescritos.


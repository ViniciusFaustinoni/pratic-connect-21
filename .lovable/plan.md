

## Plano: Aplicar desconto nas faixas FIPE ao duplicar plano

### Problema
O desconto na duplicação só é aplicado aos campos estáticos (`coberturas.valor`, `benefits.preco_sugerido`). Porém, o motor de cotação prioriza os valores das **faixas FIPE** armazenadas em `entity_eligibility_rules` (`rule_type = 'fipe_range'`, campo `rule_config.faixas[].valor`). Como esses valores não são descontados, o preço final do plano duplicado permanece idêntico ao original.

### Solução
No hook `useDuplicatePlan` (`src/hooks/usePlansAdmin.ts`), após clonar as regras de elegibilidade de cada cobertura e benefício, aplicar o desconto a todas as faixas FIPE antes de inserir no banco.

### Mudança (1 arquivo)

**`src/hooks/usePlansAdmin.ts`** — na função `useDuplicatePlan`:

1. Criar helper `applyDiscountToFipeRanges`:
```typescript
const applyDiscountToFipeRanges = (rules: any[], pct: number) => {
  if (pct <= 0) return rules;
  return rules.map(r => {
    if (r.rule_type !== 'fipe_range') return r;
    const faixas = (r.rule_config?.faixas || []).map((f: any) => ({
      ...f,
      valor: Number((f.valor * (100 - pct) / 100).toFixed(2)),
    }));
    return { ...r, rule_config: { ...r.rule_config, faixas } };
  });
};
```

2. Aplicar nos 3 pontos onde regras são clonadas:
   - Regras de **coberturas** (linha ~557): `applyDiscountToFipeRanges(clonedRules, desconto)` antes de `applyBulkRuleOverrides`
   - Regras de **benefícios** (linha ~478): `applyDiscountToFipeRanges(clonedBRules, desconto)` antes de `applyBulkRuleOverrides`
   - Regras de **plano** (linha ~415): não necessário (planos não têm fipe_range)

Isso garante que ao duplicar com 10% de desconto, cada `faixa.valor` (ex: R$ 13,75 → R$ 12,38; R$ 108,20 → R$ 97,38) será reduzido, resultando no valor mensal correto.


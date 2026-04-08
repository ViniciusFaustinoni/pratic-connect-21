

# Plano: ano_range do Plano sobrescreve ano_range da Linha

## Alteracao

Arquivo: `src/hooks/usePlanosCotacao.ts` (linhas 526-533)

Adicionar a mesma logica de sobrescrita para `ano_range`:

```typescript
const planoHasMarcaModeloRules = planoRules.some(r => r.rule_type === 'marca_modelo');
const planoHasAnoRangeRules = planoRules.some(r => r.rule_type === 'ano_range');

if (productLineId) {
  let linhaRules = allEligibilityRules.filter(r => r.entity_type === 'linha' && r.entity_id === productLineId);
  if (planoHasMarcaModeloRules) {
    linhaRules = linhaRules.filter(r => r.rule_type !== 'marca_modelo');
  }
  if (planoHasAnoRangeRules) {
    linhaRules = linhaRules.filter(r => r.rule_type !== 'ano_range');
  }
  // ...
}
```

Isso garante que se um plano define sua propria faixa de ano, a faixa da linha e ignorada para aquele plano. Caso contrario, herda a faixa da linha normalmente.

Um unico arquivo alterado, uma unica linha de logica adicionada.


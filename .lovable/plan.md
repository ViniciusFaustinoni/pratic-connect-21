

## Fix: FIPE Range Display Shows Wrong Bracket

### Root Cause

In `src/components/cotacoes/CotacaoFormDialog.tsx`, line 406:

```typescript
const faixa = todasFaixas.find(f => valorFipe >= f.fipe_min && valorFipe <= f.fipe_max);
```

`todasFaixas` contains ranges from **all** product lines and regions. `.find()` returns the **first** match, which may belong to a different line (e.g., one with R$44K–R$47K brackets) instead of the selected plan's line (R$45K–R$50K). The price engine (`usePlanosCotacao`) correctly filters by line/region, but this display-only lookup does not.

### Fix

**File: `src/components/cotacoes/CotacaoFormDialog.tsx`** — two changes:

**A) `faixaAtualFipe` (line 402-409)**: Filter `todasFaixas` by the selected plan's `linha_slug` before `.find()`. If no plan is selected yet, pick the largest matching range (most generic). The selected plan's line slug is available from `planosSelecionados[0]` or from the `planosCotados` result.

```typescript
const faixaAtualFipe = useMemo(() => {
  if (!valorFipe || valorFipe <= 0 || todasFaixas.length === 0) return null;
  const matching = todasFaixas.filter(f => valorFipe >= f.fipe_min && valorFipe <= f.fipe_max);
  if (matching.length === 0) return null;
  // If a plan is selected, prefer its line's range
  const linhaPlano = planosSelecionados[0]?.linha;
  const preferred = linhaPlano 
    ? matching.find(f => f.linha_slug === linhaPlano) 
    : null;
  // Fallback: widest range (most generic)
  const faixa = preferred || matching.sort((a, b) => (b.fipe_max - b.fipe_min) - (a.fipe_max - a.fipe_min))[0];
  return { min: faixa.fipe_min, max: faixa.fipe_max };
}, [valorFipe, todasFaixas, planosSelecionados]);
```

**B) `fipeMenorInfo` (lines 376-378)**: Same issue — the `faixaAtual` lookup also uses unfiltered `.find()`. Apply the same line-filtered logic so the "FIPE Menor" feature compares correct brackets.

### Files changed
1. `src/components/cotacoes/CotacaoFormDialog.tsx` — filter FIPE range lookups by selected plan's `linha_slug`


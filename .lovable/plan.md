

## Plan: Change Cota Display from Calculated Value to Percentage Format

### What Changes

**1. `src/hooks/usePlanosCotacao.ts`**
- Line 426-428: Change `cotaString` format from `"X% (mín R$ Y)"` to `"X% do FIPE (mín. R$ Y.YYY)"`
- Line 444: Remove `valorCota` calculation (currently `Math.round(valorMensal * decCota * 100) / 100`)
- Line 471: Set `valorCota` to `0` in the returned object (keep field for interface compat)

New cotaString format:
```typescript
const cotaString = cotaMinimaFinal === 0
  ? `${cotaPercentual}% do FIPE (sem mínimo)`
  : `${cotaPercentual}% do FIPE (mín. R$ ${cotaMinimaFinal.toLocaleString('pt-BR')})`;
```

**2. `src/components/cotacao/PlanoCardCotacao.tsx`** (line 111)
- Already displays `plano.cota` which is the string — no change needed, it will automatically show the new format.

**3. `src/components/cotacoes/PlanoDetalhesModal.tsx`** (line 136-141)
- Already displays `plano.cota` as string — no change needed.

**4. `src/components/planos/CalculadoraPreco.tsx`** (lines 1065-1070)
- Currently shows `cotaPercentual%` with `cotaMinima` — update to match new format: `"X% do FIPE · mín. R$ Y.YYY"`

**5. `src/components/cadastro/TermoFiliacaoTemplate.tsx`** (line 421)
- Currently shows `formatCurrency(plano.cotaMinima || 3000)` — change to show percentage format: `"X% do FIPE (mín. R$ Y.YYY)"`

### Files Modified
- `src/hooks/usePlanosCotacao.ts` — cotaString format + remove valorCota calc
- `src/components/planos/CalculadoraPreco.tsx` — display format
- `src/components/cadastro/TermoFiliacaoTemplate.tsx` — display format

### Not Changed
- All other motor logic (pricing, eligibility, filtering)
- The `cotaPercentual` and `cotaMinima` fields still returned for downstream use
- Interface/types unchanged


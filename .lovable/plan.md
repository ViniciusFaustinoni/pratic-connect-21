

# Fix: Calculator ignores tipo_uso toggle (particular vs aplicativo)

## Root cause

Line 470 in `CalculadoraPreco.tsx`:
```javascript
if (catLower === 'aplicativo' || tipoUsoPlano === 'aplicativo') continue;
```

This unconditionally skips every plan with `tipo_uso = 'aplicativo'`, regardless of the user's selected toggle. The correct bidirectional filter already exists on lines 481-487 but never gets reached for aplicativo plans.

## Fix

### `src/components/planos/CalculadoraPreco.tsx`

**Remove line 470.** The existing filter block (lines 481-487) already handles both directions correctly:
- When user selects "aplicativo": show aplicativo + ambos plans (+ passeio/select with deságio override)
- When user selects "particular": hide aplicativo plans

One line deleted. No other changes needed.




## Plan: Support `tipo_uso = 'ambos'` for SELECT ONE

### Problem
The filter at L347-348 of `usePlanosCotacao.ts` is binary — plans with `tipo_uso='passeio'` are excluded when `usoApp=true`, and vice versa. SELECT ONE should appear in both modes with different pricing.

Additionally, `resolverTipoUsoQuery` only returns `'aplicativo'` when the region requires a surcharge (`regiaoExigeAdicional`), but select-one has dedicated APP pricing rows in ALL regions — not just surcharge regions.

### Changes

**1. Database: Update SELECT ONE plans to `tipo_uso = 'ambos'`**

```sql
UPDATE planos SET tipo_uso = 'ambos' WHERE linha = 'select-one' AND ativo = true;
```

**2. `src/hooks/usePlanosCotacao.ts` — Update filter (L347-348)**

Change the binary filter to allow `'ambos'` through in both modes:

```typescript
// Current (binary):
if (params.usoApp && tipoUsoPlano !== 'aplicativo') continue;
if (!params.usoApp && tipoUsoPlano === 'aplicativo') continue;

// New (supports 'ambos'):
if (params.usoApp && tipoUsoPlano !== 'aplicativo' && tipoUsoPlano !== 'ambos') continue;
if (!params.usoApp && tipoUsoPlano === 'aplicativo') continue;
```

**3. `src/utils/precoApp.ts` — Fix `resolverTipoUsoQuery` for lines with dedicated APP column**

Currently, lines with a dedicated `aplicativo` column in the price table only get `'aplicativo'` as query type when `regiaoExigeAdicional`. For select-one (which has APP rows in all regions), the condition should be: if the line has a dedicated APP column, always use `'aplicativo'` regardless of region.

```typescript
// Current (L48-54):
if (temColunaApp && regiaoExigeAdicional) {
  return 'aplicativo';
}
return 'particular';

// New:
if (temColunaApp) {
  return 'aplicativo';
}
```

This is safe because `resolverPrecoApp` already skips adding the surcharge when the line has a dedicated column (the price already comes correct from the table).

**4. `src/utils/precoApp.ts` — Update `resolverPrecoApp` (no change needed)**

The existing logic already handles this correctly: when `linhasComColunaApp` includes the line, it returns `valorMensalParticular` directly without adding the surcharge. No change needed here.

### Summary of flow after fix

- **Passeio mode**: SELECT ONE passes the filter (`'ambos' !== 'aplicativo'`), queries price table with `tipo_uso='particular'`
- **APP mode**: SELECT ONE passes the filter (`'ambos'`), queries price table with `tipo_uso='aplicativo'` (dedicated column detected), gets APP price directly — no surcharge addition

### Files changed
1. **Database migration**: `UPDATE planos SET tipo_uso = 'ambos'` for select-one plans
2. **`src/hooks/usePlanosCotacao.ts`**: L347 — add `&& tipoUsoPlano !== 'ambos'`
3. **`src/utils/precoApp.ts`**: L48-54 — remove `regiaoExigeAdicional` condition for lines with dedicated APP column


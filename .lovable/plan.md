

## Plan: Fix Eligibility Logic — Any Failed Item Discards Entire Plan

### Problem
Currently, when a coverage or benefit fails eligibility rules, it's added to `coberturasRemovidas` and the plan only gets discarded if ALL items fail. The correct behavior is: if ANY item fails, discard the entire plan immediately.

### Changes

**File: `src/hooks/usePlanosCotacao.ts`**

1. **Remove imports** (lines 8-12): Delete `getCoberturasRemovidasDinamico`, `gerarMensagemAlertaCategoria`, and `BenefitExclusionData` imports from `restricoesCategorias`

2. **Remove `benefit_category_exclusions` query** (lines 211-232): Delete the entire `benefitExclusions` query block

3. **Remove `benefitExclusionsLoading` from loading check** (line 238): Remove from `dependenciasCriticasLoading`

4. **Move eligibility checks BEFORE pricing** — restructure the main loop so that individual item eligibility is checked before price calculation:

   - **Lines 438**: Remove `coberturasRemovidas = getCoberturasRemovidasDinamico(...)` 
   - **Lines 444-477**: Rewrite both eligibility loops (benefits and coverages) to use `continue planLoop` when ANY item fails instead of pushing to `coberturasRemovidas`
   - **Lines 479-490**: Remove the `itensDisponiveis` / "all items unavailable" check entirely
   - Move these eligibility checks to RIGHT AFTER the plan-level rules check (line 327), BEFORE pricing starts (line 332)

5. **Remove `alertaDesagio`** (line 492): Delete the call to `gerarMensagemAlertaCategoria`

6. **Clean up the returned object** (lines 502-533):
   - Remove `coberturasRemovidas` field (set to `[]` for interface compat)
   - Remove `alertaDesagio` field
   - Remove `elegibilidadeStatus` field

7. **Clean `useMemo` dependency array** (line 547): Remove `benefitExclusions`

### Interface Changes (`PlanoCotacao`)

- `coberturasRemovidas` — keep as `string[]` but always `[]` (avoids breaking consumers)
- `alertaDesagio` — keep as optional, always `undefined`

No changes needed in consuming components — they already handle empty arrays and undefined gracefully.

### Resulting Flow

```text
For each plano:
  1. Check linha rules → fail = skip
  2. Check plano rules → fail = skip
  3. Check EACH benefit eligibility → ANY fail = skip entire plano
  4. Check EACH cobertura eligibility → ANY fail = skip entire plano
  5. Calculate price (only reached if all items passed)
  6. Build and push result
```

### Files Modified
- `src/hooks/usePlanosCotacao.ts` — only file




## Plan: Restructure Vehicle Eligibility at Linha Level

### Summary
Replace the current two-block eligibility UI (Ano + Marca/Modelo toggles) in `LinhaFormModal` with a single "Veículos Aceitos" table using the new `rule_config.modelos` format. Update the quotation engine to read this new format and apply status-based filtering (aceito/limitado/negado).

### Changes

**1. New Component: `src/components/admin/planos/VeiculosAceitosEditor.tsx`**

A self-contained editor with:
- A table displaying existing models from the `marca_modelo` rule's `rule_config.modelos` array (columns: Marca, Modelo, Ano De, Ano Até, Status, Combustível, Cobertura FIPE %, Remover)
- An inline form row to add new entries (Marca/Modelo as text inputs with auto-uppercase, Ano fields as optional numbers, Status dropdown, Combustível dropdown, Cobertura FIPE % defaulting to 100)
- On add: upsert the `entity_eligibility_rules` record — if a `marca_modelo` rule already exists for this linha, update its `rule_config.modelos` array appending the new item via `useUpdateRule`; otherwise create a new rule via `useSaveRule`
- On remove: update the array removing the item; if array becomes empty, delete the rule via `useDeleteRule`
- Uses `useRulesForEntity('linha', entityId)` to read current state

**2. Update `src/components/admin/planos/LinhaFormModal.tsx`**

- Remove the "Restringir por Ano de Fabricação" block (lines 312-360) and its state (`anoEnabled`, `anoMin`, `anoMax`, `handleSaveAnoRule`)
- Remove the "Restringir por Marca / Modelo" block with `MarcaModeloExclusionEditor` (lines 362-381) and its state (`marcaModeloEnabled`)
- Remove the `anoRule` derivation and sync effects (lines 69, 81-83, 114-131)
- Replace with a single section "Veículos Aceitos" rendering `<VeiculosAceitosEditor entityId={productLine.id} />`, visible only when `isEditing === true`
- Remove `handleSaveAnoRule` call from `handleSubmit` — the new editor handles persistence inline

**3. Update `src/hooks/useEntityEligibilityRules.ts` — `checkRuleAgainstVehicle`**

Update the `marca_modelo` case (lines 178-193) to handle the new `modelos` array format with per-item `status`, `ano_min`, `ano_max`, `combustivel`:

```text
case 'marca_modelo' with new format:
  - If rule_config.modelos is an array of objects (has .status field):
    - Find matching entry by marca + modelo (case-insensitive contains)
    - If match found, also check ano_min/ano_max against ctx.anoVeiculo
    - Also check combustivel (if not 'qualquer', must match ctx.combustivel)
    - If match found and status='negado' → return false (block)
    - If match found and status='aceito' → return true
    - If match found and status='limitado' → return true (allowed but flagged)
    - If no match found → return !isInclude (whitelist: block; blacklist: allow)
  - Otherwise: fall through to legacy logic (existing behavior for plano-level rules)
```

Add a new exported function `findModelEligibility` that returns `{ status, coberturaFipe }` for a given vehicle context against a marca_modelo rule — used by the quotation engine.

**4. Update `src/hooks/usePlanosCotacao.ts`**

After the linha rules check (line 293-297), add model-level eligibility resolution:

```text
// Find marca_modelo rule for this linha
const linhaMarcaModeloRule = allEligibilityRules.find(
  r => r.entity_type === 'linha' && r.entity_id === productLineId 
    && r.rule_type === 'marca_modelo' && r.is_active
);

if (linhaMarcaModeloRule) {
  const modelMatch = findModelEligibility(linhaMarcaModeloRule, vehicleCtx);
  if (modelMatch) {
    if (modelMatch.status === 'negado') {
      negados.push(...); continue;
    }
    // Store status and coberturaFipe override for later use
    linhaElegibilidadeStatus = modelMatch.status;
    coberturaFipeOverride = modelMatch.coberturaFipe;
  }
}
```

At the end when building the result object (line 452-483):
- Set `elegibilidadeStatus` to `linhaElegibilidadeStatus` (instead of hardcoded `undefined`)
- Set `coberturaFipe` to `coberturaFipeOverride` when available (instead of `plano.cobertura_fipe || 100`)

### Files Modified
- `src/components/admin/planos/VeiculosAceitosEditor.tsx` — **new file**
- `src/components/admin/planos/LinhaFormModal.tsx` — replace eligibility blocks
- `src/hooks/useEntityEligibilityRules.ts` — new format handling + `findModelEligibility`
- `src/hooks/usePlanosCotacao.ts` — read model status from linha rules

### Not Changed
- `plano_elegibilidade_modelos` table (not removed, just no longer used at linha level)
- Plan-level eligibility rules (existing `marca_modelo` rules for entity_type='plano' continue working with legacy format)
- No database migrations needed — `rule_config` is a JSONB column, new format is just a different JSON structure
- Price calculation logic, cota logic, benefit/coverage eligibility checks


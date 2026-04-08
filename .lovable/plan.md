

## Plan: Cascading Marca/Modelo Selects from `marcas_modelos` Table

### Summary
Replace the free-text Marca and Modelo inputs in `VeiculosAceitosEditor.tsx` with two cascading `SearchableSelect` components fed by the `marcas_modelos` database table. The selected modelo value is trimmed to its first word before saving.

### Changes

**File: `src/hooks/useMarcasModelos.ts`** -- Add two new hooks

- `useMarcasDistintas()`: queries `marcas_modelos` selecting distinct `marca` values, ordered alphabetically. Returns `string[]`.
- `useModelosPorMarca(marca: string)`: queries `marcas_modelos` where `marca = marca`, selects distinct `modelo`, ordered alphabetically. Enabled only when `marca` is non-empty. Returns `string[]`.

Both use the existing supabase client and react-query.

**File: `src/components/admin/planos/VeiculosAceitosEditor.tsx`**

- Import `SearchableSelect` and the two new hooks
- Replace the Marca `<Input>` with a `<SearchableSelect>` fed by `useMarcasDistintas()`. On change, reset the modelo selection.
- Replace the Modelo `<Input>` with a `<SearchableSelect>` fed by `useModelosPorMarca(marca)`. Disabled until a marca is selected. The full FIPE model name is shown in the dropdown (e.g., "COROLLA XEi 2.0 Flex 16V Aut.").
- In `handleAdd`, extract the first word of the selected modelo string: `selectedModelo.split(' ')[0]` — this is what gets saved in `rule_config.modelos[].modelo`.
- Ano de, Ano até, Status, and all persistence logic remain unchanged.

### Technical Detail

The `marcas_modelos` table has ~11k rows. The marca select derives distinct brands client-side from the query. The modelo select filters by the chosen brand. Since the table may hit the 1000-row Supabase default limit, the hooks will use `.limit(50000)` or paginate to ensure all records load. Alternatively, the marca query can use a Postgres `distinct` via RPC, but the simpler approach is to fetch all and deduplicate client-side since `useMarcasModelos()` already does this.

The first-word extraction (`modelo.split(' ')[0]`) produces values like `COROLLA`, `CIVIC`, `ONIX` — matching the partial-match logic already in `findModelEligibility`.

### Files Modified
- `src/hooks/useMarcasModelos.ts` — add 2 hooks
- `src/components/admin/planos/VeiculosAceitosEditor.tsx` — swap inputs for selects

### Not Changed
- Persistence logic, rule_config format, eligibility engine, any other component


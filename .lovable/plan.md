

## Plan: Deságio Pricing Fix + Vehicle Depreciation Flags

### Correção 1 — Cotador (Pricing)

**Status: Already implemented.** The code at lines 497-503 of `usePlanosCotacao.ts` already:
- Derives `isDesagio` from `categoriasDesagio` (loaded from DB config)
- Swaps `valorMensal = valorDesagio` when `isDesagio && linhasComDesagio.includes(linhaSlug)`
- Forces `cotaCategoriaLookup = 'desagio'` at line 543

No code changes needed for Correção 1. If plans are still not appearing, the issue is elsewhere (e.g., `blocked_categories` not yet cleaned in DB, or `valor_desagio` being null/0 causing the `valorMensal === 0` filter at line 511).

---

### Correção 2 — Vehicle Depreciation Flags

**A) Database migration — add 7 boolean columns to `veiculos`**

```sql
ALTER TABLE veiculos
  ADD COLUMN IF NOT EXISTS flag_placa_vermelha boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_ex_taxi boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_taxi_ativo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_chassi_remarcado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_leilao boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_ex_ressarcido boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_avarias_vistoria boolean DEFAULT false;
```

**B) Auto-populate flags from quotation category**

In the contract generation edge function (`supabase/functions/contrato-gerar/index.ts`), when creating the vehicle record, map the `cotacao.categoria` to the corresponding flag:

```typescript
const categoriaFlags = {
  flag_placa_vermelha: cotacao.categoria === 'placa_vermelha',
  flag_ex_taxi: cotacao.categoria === 'ex_taxi',
  flag_taxi_ativo: cotacao.categoria === 'taxi',
  flag_chassi_remarcado: cotacao.categoria === 'chassi_remarcado',
  flag_leilao: cotacao.categoria === 'leilao',
  flag_ex_ressarcido: cotacao.categoria === 'ressarcimento_integral',
};
```

These flags get saved to the `veiculos` table when the vehicle is created from a contract. The `flag_avarias_vistoria` stays manual (set during inspection).

Also update `AssociadoFormDialog.tsx` (`useCreateVeiculo` call) to pass the same mapping if a category is available.

**C) Update `IniciarIndenizacaoModal.tsx` — auto-read flags from vehicle**

Currently, depreciation checkboxes are manual. Update to:
1. Fetch the vehicle's flags when the modal opens
2. Pre-check the corresponding depreciation switches based on the flags
3. Keep the existing depreciation calculation logic (applies the highest: 25% for placa_vermelha/ex_taxi/taxi, 30% for leilao/chassi_remarcado/ex_ressarcido, then 20% additional for avarias on top)

Update the `DEPRECIACOES` array to match the new granular flags:

```typescript
const DEPRECIACOES = [
  { key: 'flag_placa_vermelha', label: 'Placa vermelha', percentual: 25 },
  { key: 'flag_ex_taxi', label: 'Ex-táxi', percentual: 25 },
  { key: 'flag_taxi_ativo', label: 'Táxi ativo', percentual: 25 },
  { key: 'flag_chassi_remarcado', label: 'Chassi remarcado', percentual: 30 },
  { key: 'flag_leilao', label: 'Veículo de leilão', percentual: 30 },
  { key: 'flag_ex_ressarcido', label: 'Já indenizado anteriormente', percentual: 30 },
  { key: 'flag_avarias_vistoria', label: 'Avarias pré-existentes (vistoria)', percentual: 20, isAdditional: true },
];
```

Update calculation: apply the highest non-avarias depreciation first, then apply 20% additional on the already-depreciated value if `flag_avarias_vistoria` is true.

### Files changed
1. **Database migration**: add 7 boolean columns to `veiculos`
2. **`supabase/functions/contrato-gerar/index.ts`**: map category to flags when creating vehicle
3. **`src/components/associados/AssociadoFormDialog.tsx`**: pass category flags on manual vehicle creation
4. **`src/components/sinistros/IniciarIndenizacaoModal.tsx`**: fetch vehicle flags, pre-check switches, update depreciation calculation (highest + avarias additional)


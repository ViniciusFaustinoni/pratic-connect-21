

## Plan: Mínimo de adesão volante por role do consultor

### Problem
Currently, `useTaxaAdesaoMinimoVolante` returns a single value from `taxa_adesao_minimo_volante`. The business requires different minimums: R$150 for `vendedor_clt` and R$50 for `vendedor_externo`.

### Changes

**1. Database migration — add two new config keys**

```sql
INSERT INTO configuracoes (chave, valor, descricao, categoria)
VALUES
  ('taxa_adesao_minimo_volante_interno', '150', 'Mínimo adesão volante - vendedor CLT', 'taxas'),
  ('taxa_adesao_minimo_volante_externo', '50', 'Mínimo adesão volante - vendedor externo', 'taxas')
ON CONFLICT (chave) DO NOTHING;
```

**2. `src/hooks/useConteudosSistema.ts` — add two new hooks**

```typescript
export function useTaxaAdesaoMinimoVolanteInterno() {
  return useConfiguracaoNumero('taxa_adesao_minimo_volante_interno', 150);
}

export function useTaxaAdesaoMinimoVolanteExterno() {
  return useConfiguracaoNumero('taxa_adesao_minimo_volante_externo', 50);
}
```

**3. `src/pages/vendas/Cotador.tsx` (L238, L278)**

Replace:
```typescript
const { data: minimoAdesaoVolante = 100 } = useTaxaAdesaoMinimoVolante();
```
With:
```typescript
const { data: minimoVolanteInterno = 150 } = useTaxaAdesaoMinimoVolanteInterno();
const { data: minimoVolanteExterno = 50 } = useTaxaAdesaoMinimoVolanteExterno();
```

Then at L278:
```typescript
const minimoAdesaoVolante = isVendedorExterno ? minimoVolanteExterno : minimoVolanteInterno;
const minimoAdesaoConfig = tipoInstalacao === 'rota' ? minimoAdesaoVolante : minimoAdesaoBase;
```

**4. `src/components/cotacoes/CotacaoFormDialog.tsx` (L168, L179)**

Same pattern — replace `useTaxaAdesaoMinimoVolante()` with the two role-specific hooks, and derive `minimoAdesaoVolante` based on `isVendedorExterno` (already available at L165).

**5. `src/pages/diretoria/RegrasVenda.tsx` — update UI to show both configs**

Replace the single "Mínimo volante" field with two fields:
- "Mínimo volante — Vendedor CLT" → `taxa_adesao_minimo_volante_interno`
- "Mínimo volante — Vendedor Externo" → `taxa_adesao_minimo_volante_externo`

### Files changed
1. **Database migration**: Insert two new config keys
2. **`src/hooks/useConteudosSistema.ts`**: Add two new hooks
3. **`src/pages/vendas/Cotador.tsx`**: Derive volante minimum by role
4. **`src/components/cotacoes/CotacaoFormDialog.tsx`**: Same derivation
5. **`src/pages/diretoria/RegrasVenda.tsx`**: Split single field into two


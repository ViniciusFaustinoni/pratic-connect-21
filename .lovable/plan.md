

## Fix: Deságio Flow in Cotador

### Problem
Two bugs in `usePlanosCotacao.ts`:
1. **Price**: `valor_desagio` is fetched but never used as the active price when a deságio category is selected
2. **Cota**: Category-based deságio selections don't force the 8%/R$2.000 cota — only `elegibilidadeStatus === 'limitado'` does

### Changes — single file: `src/hooks/usePlanosCotacao.ts`

**A) Define deságio categories constant (top of file)**

```typescript
const CATEGORIAS_DESAGIO = ['chassi_remarcado', 'placa_vermelha', 'ex_taxi', 'taxi', 'leilao', 'ressarcimento_integral'];
const LINHAS_COM_DESAGIO = ['select', 'lancamento'];
```

**B) Derive `isDesagio` flag (~L500, before cota logic)**

```typescript
const isDesagio = !!categoria && CATEGORIAS_DESAGIO.includes(categoria);
```

**C) Bug 1 fix — swap price when deságio + eligible line (~L462, after faixa lookup)**

After the existing price assignment block, add:

```typescript
// Deságio: use valor_desagio as base price for eligible lines
if (isDesagio && valorDesagio != null && LINHAS_COM_DESAGIO.includes(linhaSlug || '')) {
  valorMensal = valorDesagio;
}
```

This goes right after L461 (`valorDesagio = faixa.valor_desagio`), before the APP adicional logic at L465. For lines not in `LINHAS_COM_DESAGIO` (especial, advanced, etc.), `valorMensal` stays unchanged.

**D) Bug 2 fix — force cota lookup to 'desagio' (~L502)**

Update the cota category resolution to include `isDesagio`:

```typescript
let cotaCategoriaLookup = categoria || 'passeio';
if (params.usoApp) cotaCategoriaLookup = 'aplicativo';
if (elegibilidadeStatus === 'limitado' || isDesagio) cotaCategoriaLookup = 'desagio';
```

This ensures all deságio categories (chassi_remarcado, leilao, etc.) get the same 8%/R$2.000 cota via the existing `'desagio'` lookup path, which falls back to `cota_desagio` / `cota_minima_desagio` fields (defaults: 8% / R$2.000).

### Expected results after fix

| Scenario | Price | Cota |
|----------|-------|------|
| Select Basic, chassi_remarcado | R$188,90 (valor_desagio) | 8% mín R$2.000 |
| Especial, chassi_remarcado | unchanged (no valor_desagio swap) | 8% mín R$2.000 |
| Select Basic, sem deságio | R$218,90 (valor_mensal) | 6% mín R$1.200 |

### Files changed
1. `src/hooks/usePlanosCotacao.ts` — add constants, isDesagio flag, price swap, cota override


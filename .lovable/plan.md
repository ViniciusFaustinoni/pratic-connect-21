

## Plan: Deságio Visual Alerts in Cotador

### Problem
1. When deságio pricing is active, plan cards show no visual indicator that the price differs from standard.
2. Category observation text is hardcoded in `ALERTAS_CATEGORIA` in `CotacaoFormDialog.tsx` instead of coming from the DB config `observacoes_categoria`.
3. Coverage exclusions (e.g., "Incêndio" for leilão) already work via `benefit_category_exclusions` table and render as strikethrough in `PlanoCardCotacao` — no changes needed there.

### Changes

**A) `usePlanosCotacao.ts` — Add `precoDesagioAplicado` flag to `PlanoCotacao`**

Add a boolean field `precoDesagioAplicado` to the `PlanoCotacao` interface. Set it to `true` at line 501-502 when `isDesagio && valorDesagio != null && linhasComDesagio.includes(linhaSlug)`. Include it in the pushed object. This tells the card whether to show the deságio badge.

**B) `PlanoCardCotacao.tsx` — Show "Preço com deságio" badge**

When `plano.precoDesagioAplicado` is true, render a small badge below the price display (line 95-100):
```
<Badge className="bg-amber-100 text-amber-800 ...">Preço com deságio aplicado</Badge>
```

**C) `CotacaoFormDialog.tsx` — Replace hardcoded `ALERTAS_CATEGORIA` with DB config**

1. Import and call `useObservacoesCategoria()` from `useConteudosSistema`.
2. Delete the `ALERTAS_CATEGORIA` constant (lines 87-112).
3. Update the `alertaCategoria` useMemo (line 430) to read from `observacoesCategoria[categoria]` instead.
4. Render as a warning-style alert (amber) when text exists — same pattern already used in `EtapaResultado.tsx` line 180-187.

### Files changed
1. **`src/hooks/usePlanosCotacao.ts`** — add `precoDesagioAplicado` to interface + set flag in calculation
2. **`src/components/cotacao/PlanoCardCotacao.tsx`** — render deságio badge when flag is true
3. **`src/components/cotacoes/CotacaoFormDialog.tsx`** — replace hardcoded alerts with `useObservacoesCategoria()` from DB

### What already works (no changes needed)
- Coverage exclusions by category (strikethrough in plan cards) — driven by `benefit_category_exclusions` table
- `alertaDesagio` text in plan cards — already generated from `gerarMensagemAlertaCategoria()` using DB exclusions
- `observacoesCategoria` hook — already exists and is used in `EtapaResultado.tsx`


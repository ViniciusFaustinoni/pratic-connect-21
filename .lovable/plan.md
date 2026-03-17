

## Plan: Split repasse volante into internal vs external

The "Valor mínimo por tipo de atendimento" block already distinguishes between internal (CLT) and external sellers. The "Repasse para instalações fora da base" block below it still has a single `taxa_repasse_volante` field. This needs to match the same pattern.

### Changes

**1. Database** — Add new config key `taxa_repasse_volante_externo` (the existing `taxa_repasse_volante` becomes the internal value, and a new key handles external). The external seller already has `comissao_ext_valor_volante` in `ComissionamentoExternoConfig`, so the new key will reference that same value or be a separate Regras de Venda-level config. Given the user wants it in Regras de Venda alongside the internal one, I'll add `taxa_repasse_volante_externo` to `configuracoes`.

**2. `src/pages/diretoria/RegrasVenda.tsx`**
- Add `taxa_repasse_volante_externo` to `TAXAS_CHAVES` and `TAXAS_DEFAULTS`
- Update the "Repasse volante" card (lines 993-1026) to show two fields:
  - "Repasse volante — Vendedor CLT (interno)" → `taxa_repasse_volante`
  - "Repasse volante — Vendedor Externo" → `taxa_repasse_volante_externo`
- Update the info alert to clarify both rules apply to their respective seller types

**3. `src/hooks/useConteudosSistema.ts`**
- Add `useTaxaRepasseVolanteExterno()` hook reading `taxa_repasse_volante_externo`

**4. `src/pages/vendas/Cotador.tsx`** and `src/components/cotacoes/CotacaoFormDialog.tsx`**
- Use the appropriate repasse value based on whether the current user is an external seller (`isVendedorExterno`): use `repasseVolanteExterno` for externals, `repasseVolante` for internals

### Files changed
1. Migration — insert `taxa_repasse_volante_externo` config key
2. `src/pages/diretoria/RegrasVenda.tsx` — split repasse card into 2 fields
3. `src/hooks/useConteudosSistema.ts` — add new hook
4. `src/pages/vendas/Cotador.tsx` — use correct repasse per seller type
5. `src/components/cotacoes/CotacaoFormDialog.tsx` — use correct repasse per seller type


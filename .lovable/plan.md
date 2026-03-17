

## Plan: Merge Regras de Venda into Gestão Comercial

Unify everything under a single **Gestão Comercial** page. "Regras de Venda" becomes a 6th tab alongside the existing 5.

### Structure after change

| # | Tab | Content |
|---|-----|---------|
| 0 | Planos, Produtos e Preços | `ProdutosPlanos` (existing) |
| 1 | Benefícios & Coberturas | `BeneficiosCoberturas` (existing) |
| 2 | Adicionais | `BeneficiosAdicionaisConfig` (existing) |
| 3 | Simulador de Rateio | `SimuladorRateio` (existing) |
| 4 | Elegibilidade | `ElegibilidadeVeiculos` (existing) |
| 5 | **Regras de Venda** | New wrapper component containing the 6 sub-sections (Pontuação, Repasse, Migração, Taxas, Autorizações, Indicação) |

### Changes

**1. Extract RegrasVenda content into a reusable component**

Create `src/components/gestao-comercial/RegrasVendaContent.tsx` — move all logic and UI from `RegrasVenda.tsx` (interfaces, hooks, state, save handlers, tab content) into this component, removing only the page-level header/wrapper. The internal sub-tabs (Pontuação, Repasse, etc.) remain as they are.

**2. Add "Regras de Venda" tab to TabNavigation**

In `TabNavigation.tsx`, add a 6th tab: `{ label: 'Regras de Venda', icon: Gavel }`.

**3. Wire tab in GestaoComercial.tsx**

Add `{activeTab === 5 && <RegrasVendaContent />}`.

**4. Remove standalone route and sidebar entry**

- `App.tsx`: Change `/diretoria/regras-venda` route to redirect to `/diretoria/gestao-comercial`
- `AppSidebar.tsx`: Remove the "Regras de Venda" sidebar item from the Diretoria group
- `GlobalBreadcrumb.tsx`: Remove the `/diretoria/regras-venda` breadcrumb entry

### Files changed

1. **New**: `src/components/gestao-comercial/RegrasVendaContent.tsx`
2. `src/components/gestao-comercial/TabNavigation.tsx` — add 6th tab
3. `src/pages/diretoria/GestaoComercial.tsx` — render new tab
4. `src/pages/diretoria/RegrasVenda.tsx` — simplify to import+render `RegrasVendaContent` (keeps working as redirect target)
5. `src/App.tsx` — redirect old route
6. `src/components/layout/AppSidebar.tsx` — remove sidebar item
7. `src/components/layout/GlobalBreadcrumb.tsx` — cleanup breadcrumb




## Plan: Rename "Cobrança" → "Relacionamento" + Reactivation Wizard

### Part 1 — Rename module label (visual only, no route changes)

The module `id` stays `cobranca` everywhere (routes, DB, permissions). Only the **display label** changes to "Relacionamento".

**Files to change:**

1. **`src/config/modules.ts`** (line 27): Change `label: 'Cobrança'` → `label: 'Relacionamento'`

2. **`src/components/layout/AppSidebar.tsx`** (line 296): Change `label: 'Cobrança'` → `label: 'Relacionamento'`

3. **`src/pages/cobranca/CobrancaDashboard.tsx`** (line 222): Change page title `Central de Cobrança` → `Central de Relacionamento`

4. **`src/pages/cobranca/ReguaCobranca.tsx`** (lines 159-160): Update header text from "Régua de Cobrança" → "Régua de Relacionamento" and description accordingly

5. **`src/pages/cobranca/InadimplenteDetalhe.tsx`** (lines 312, 326): Update card titles "Timeline de Cobrança" → "Timeline de Relacionamento", "Ações de Cobrança" → "Ações de Relacionamento"

No route paths (`/cobranca/*`) or internal IDs change — only user-facing text.

### Part 2 — Reactivation Wizard

#### New component: `src/components/associados/reativacao/ReativacaoWizard.tsx`

A dialog/wizard that:
- Receives `associadoId`, `contratoId`, and the `situacao` object (from `useAssociadoSituacao`)
- Uses `useInadimplenciaPrazos()` to get the 3 configured thresholds
- Automatically determines which path applies based on `situacao.diasAtraso` vs the configured thresholds
- Shows a step-by-step flow for the determined path

**Path determination logic:**
```text
diasAtraso ≤ prazoSemRevistoria  →  Path 1 (payment only)
diasAtraso ≤ prazoNovaAdesao     →  Path 2 (payment + inspection)
diasAtraso > prazoNovaAdesao     →  Path 3 (full new enrollment)
```

**Path 1 — Simple payment** (1 step):
- Shows which billing is overdue and days count
- Shows the configured threshold being applied
- Confirm payment button → calls existing `reativarAssociado` mutation

**Path 2 — Payment + Inspection** (2 steps):
- Step 1: Confirm payment of overdue billing
- Step 2: Confirm inspection status (done or scheduled). Info banner: "A revistoria pode ser feita pelo app do associado sem custo adicional"
- Both confirmed → calls `reativarAssociado`

**Path 3 — Full new enrollment** (4 steps):
- Step 1: Clear all outstanding debts
- Step 2: New enrollment fee payment
- Step 3: New vehicle inspection
- Step 4: New tracker installation (when applicable, based on `pendenciaRastreador` or vehicle data)
- On completion: registers as new enrollment operation + assigns consultant points via `pontuacao_eventos` insert

All paths display a header banner explaining: "Associado inadimplente há X dias. Prazo configurado: Y dias (sem revistoria) / Z dias (nova adesão). Caminho determinado: [name]."

#### Integration point: `src/pages/cadastro/AssociadoDetalhe.tsx`

- Import and render `ReativacaoWizard` dialog
- Add state `reativacaoWizardOpen`
- Change `handleReativar` to open the wizard instead of calling `reativarAssociado` directly
- Show "Reativar associado" button when status is `suspenso` OR `inadimplente` OR `situacao.coberturasSuspensas === true`

#### Update: `src/components/associados/detalhe/AssociadoHeroHeader.tsx`

- Change the reactivation button visibility condition from `status === 'suspenso'` to also include when `coberturasSuspensas` is true (passed as new prop)
- Button calls new `onReativarWizard` callback instead of `onReativar`

### Files changed

1. `src/config/modules.ts` — label rename
2. `src/components/layout/AppSidebar.tsx` — sidebar label rename
3. `src/pages/cobranca/CobrancaDashboard.tsx` — page title rename
4. `src/pages/cobranca/ReguaCobranca.tsx` — header rename
5. `src/pages/cobranca/InadimplenteDetalhe.tsx` — card titles rename
6. `src/components/associados/reativacao/ReativacaoWizard.tsx` — **new** wizard component
7. `src/pages/cadastro/AssociadoDetalhe.tsx` — integrate wizard, replace direct reactivation
8. `src/components/associados/detalhe/AssociadoHeroHeader.tsx` — update button visibility


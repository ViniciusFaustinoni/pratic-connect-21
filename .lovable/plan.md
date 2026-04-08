

## Plan: Remove Hardcoded Plan Filtering — Use Only `checkAllRules` Engine

### Problem
The quotation engine in `usePlanosCotacao.ts` has multiple redundant filtering layers that bypass the unified eligibility rules engine (`entity_eligibility_rules`). These hardcoded filters prevent correctly-configured rules from working.

### What to Remove

**1. `verificarElegibilidadeModelo` function (lines 268-334) and its usage (lines 450-498)**
This entire whitelist system (`plano_elegibilidade_modelos` table) duplicates what `entity_eligibility_rules` with `marca_modelo` rule type already handles. Remove the function, the query (lines 213-224), and all usage in the main loop.

**2. `configApp` / `supports_app` eligibility logic (lines 337-347)**
Remove the `supports_app` field from being used to determine plan visibility. The APP eligibility should come from `entity_eligibility_rules` on coverages/benefits.

**3. `blocked_categories` from product_lines query (line 168)**
Already fetched but appears unused in filtering. Clean it from the query to avoid confusion.

**4. Vehicle type filter (lines 420-421)**
Currently filters moto/carro by `product_lines.vehicle_type`. This should also be handled by eligibility rules. Remove these hardcoded `continue` statements.

### What to Keep
- `ativo = true` and `visivel_gestao = true` filters on the query (line 173)
- Entity eligibility rules checks for **linha** (lines 431-443) and **plano** (lines 445-448)
- Individual **cobertura/benefício** eligibility checks (lines 620-673) — the core engine
- "Hide plan if ALL items unavailable" logic (lines 662-673)
- All pricing logic (unchanged)
- All cota/deságio logic (unchanged)

### What to Clean Up
- Remove `elegibilidadeData` query and related variables
- Remove `MARCA_ALIASES`, `normalizarMarcaElegibilidade` helper
- Remove `elegibilidadeStatus` / `elegibilidadeCoberturaFipe` variables from the loop
- Remove `elegibilidadeLoading` / `elegibilidadeError` from dependency checks
- Simplify `dependenciasCriticasLoading` accordingly

### Files Changed
- `src/hooks/usePlanosCotacao.ts` — only file modified

### Testing
After changes, navigate to quotation form and test:
1. Carro flex, passeio, RJ, FIPE R$72.000
2. Carro diesel, passeio, RJ, FIPE R$72.000
3. Carro flex, aplicativo, RJ, FIPE R$72.000


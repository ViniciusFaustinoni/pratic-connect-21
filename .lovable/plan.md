

## Plan: Ownership Transfer — Scenario A/B Logic + Config + Button

### Summary

Add smart vistoria dispensation to the ownership transfer flow based on configurable thresholds, add configuration fields in Regras de Venda, and add a "Troca de Titularidade" button on the associate detail page.

### Part 1 — Database: Add 2 new config keys

**Migration**: Insert two new rows into `configuracoes`:
- `troca_titularidade_prazo_dispensa_vistoria` (value: `"0"`) — max days between cancellation and new activation to dispense vistoria
- `troca_titularidade_dispensa_vistoria_ativa` (value: `"true"`) — toggle to enable/disable scenario A

### Part 2 — Regras de Venda UI: New "Troca de Titularidade" block

In `src/pages/diretoria/RegrasVenda.tsx`, in the "Taxas e Adesão" tab, after the existing "Taxas para procedimentos específicos" card (line ~1024), add a new Card:

- **Title**: "Troca de Titularidade"
- **Fields**:
  1. Toggle (Switch): "Permitir dispensa de vistoria no Cenário A" — reads/writes `troca_titularidade_dispensa_vistoria_ativa`
  2. Number input: "Prazo máximo (dias) para considerar troca no mesmo dia" — reads/writes `troca_titularidade_prazo_dispensa_vistoria`. Disabled when toggle is off.
- Save uses the same `handleSaveTaxas` pattern (add the 2 new keys to `TAXAS_CHAVES` or a separate save block within the same tab)

### Part 3 — Edge Function: Scenario A/B logic in `aprovar-solicitacao-ia`

In `supabase/functions/aprovar-solicitacao-ia/index.ts`, in the `troca_titularidade` block (line ~598):

**Before** creating the vistoria service, add:
1. Read configs `troca_titularidade_dispensa_vistoria_ativa` and `troca_titularidade_prazo_dispensa_vistoria` from `configuracoes`
2. Check if the associate's vehicle is still active (`veiculos.status = 'ativo'`)
3. If the vehicle has a cancellation date, calculate days between cancellation and now
4. **Scenario A** (dispense vistoria): if toggle is active AND (vehicle still active OR days since cancellation ≤ configured threshold):
   - Skip vistoria creation
   - Keep tracker as-is (no `pendencia_rastreador`)
   - Log the dispensation reason
5. **Scenario B** (require vistoria): otherwise:
   - Create vistoria service as today
   - If vehicle was cancelled and tracker not returned (`pendencia_rastreador`), register the pending status before proceeding

### Part 4 — "Troca de Titularidade" button on associate detail

In `src/components/associados/detalhe/AssociadoHeroHeader.tsx`:
- Add a new button next to "Substituir" (line ~197), visible when `status === 'ativo'` and user is not `isAnalistaCadastroOnly`
- Icon: `Users` (from lucide). Label: "Troca Titular"
- Calls a new `onTrocaTitularidade` callback prop

In `src/pages/cadastro/AssociadoDetalhe.tsx`:
- Add handler that navigates to the existing transfer flow or opens a dialog
- Since the current transfer flow lives in the IA solicitation system, the button should open a `TrocaTitularidadeDialog` that collects new owner data (name, CPF, email, phone) and creates a `chat_solicitacoes_ia` record with `tipo: 'troca_titularidade'`

New file: `src/components/associados/TrocaTitularidadeDialog.tsx`
- Dialog with form fields: nome, CPF, email, telefone do novo titular
- On submit: inserts into `chat_solicitacoes_ia` with `tipo: 'troca_titularidade'` and the collected data
- Shows success message explaining next steps

### Files changed

1. **Migration** — insert 2 config rows
2. `src/pages/diretoria/RegrasVenda.tsx` — new "Troca de Titularidade" config block
3. `supabase/functions/aprovar-solicitacao-ia/index.ts` — scenario A/B logic before vistoria creation
4. `src/components/associados/detalhe/AssociadoHeroHeader.tsx` — new button
5. `src/pages/cadastro/AssociadoDetalhe.tsx` — integrate dialog
6. **New**: `src/components/associados/TrocaTitularidadeDialog.tsx` — dialog for collecting new owner data




## Plan: Connect Referral System — Cotador, Associate Detail, Config Tab

### Part 1 — Fix cotador → contract indicação data flow

The cotador already has real-time search for the referrer (working). The problem is `PrefilledCotacaoData` doesn't include indicação fields, so the data is lost when navigating to contracts.

**Changes:**

1. **`src/components/contratos/ContratoFormDialog.tsx`** — Add `indicacao?: { indicador_id: string; indicador_nome: string }` to `PrefilledCotacaoData`. When creating the contract, if indicação data exists, also insert/update the `indicacoes` table record linking `indicador_id` to the new `associado_id` with status `convertido`.

2. **`src/pages/vendas/Cotacao.tsx`** — Already passes `indicacao` in `dadosCotacao`. The `PrefilledCotacaoData` also needs `associado` fields (nome, email, telefone) and `indicacao`. Currently `dadosCotacao` has them but the interface doesn't — extend it.

3. **Contract creation flow** (`ContratoFormDialog` or the `useCreateContrato` hook) — After successful contract + associado creation, if `indicacao` data was provided:
   - Query `indicacoes` for a matching record (`indicador_id` + `indicado_telefone` or `indicado_nome`) and update its `status` to `convertido`, `associado_id` to the new associate, `data_conversao` to now
   - If no existing record found, insert a new `indicacoes` row with status `convertido`

### Part 2 — "Origem do cadastro" section in associate detail

**New component:** `src/components/associados/detalhe/OrigemCadastroCard.tsx`

A read-only card that queries:
- `indicacoes` table where `associado_id = current associate id` to find if they were referred
- `contratos` table for consultant info and creation date

Displays:
- **Tipo de entrada**: Determined by checking if an `indicacoes` record exists (→ "Indicação"), or if `contrato.tipo_instalacao` or other fields suggest migration/reactivation. Falls back to "Nova adesão"
- **Indicador**: Name with link to `/cadastro/associados/{indicador_id}` (only when type is Indicação)
- **Consultor responsável**: From contract's vendedor join
- **Data da conversão**: Contract creation date or indicação `data_conversao`

**Integration:** Add this card to `AssociadoResumoTab.tsx` between the Situação card and the Info Grid, passing the `associado.id`.

### Part 3 — "Indicação" tab in Regras de Venda

Add a new tab to `src/pages/diretoria/RegrasVenda.tsx`.

**New config keys** (insert into `configuracoes` table via migration):
- `indicacao_validade_dias` — default `"30"`
- `indicacao_valor_recompensa` — default `"50"`
- `indicacao_momento_pagamento` — default `"apos_conversao"` (options: `apos_conversao`, `apos_primeiro_boleto`)
- `indicacao_gera_pontuacao_consultor` — default `"true"`

**Tab UI:**
- Number input: "Prazo de validade da indicação (dias)"
- Currency input: "Valor da recompensa para o indicador (R$)"
- Select: "Momento do pagamento" with 2 options
- Toggle: "Indicação gera pontuação para o consultor"
- Save button using same pattern as other tabs (upsert into `configuracoes`)

Add `TabsTrigger value="indicacao"` with `UserPlus` icon after "Autorizações e Exceções".

**Note:** The existing `programa_indicacao` table has similar fields (`prazo_validade_dias`, `valor_indicador`, `condicao_pagamento`). The new config keys in `configuracoes` serve as global defaults. The `programa_indicacao` records override these when a specific program is active.

### Files changed

1. **Migration** — insert 4 new config keys into `configuracoes`
2. `src/components/contratos/ContratoFormDialog.tsx` — extend `PrefilledCotacaoData` with indicação, handle post-creation indicação update
3. `src/components/associados/detalhe/OrigemCadastroCard.tsx` — **new** read-only origin card
4. `src/components/associados/detalhe/AssociadoResumoTab.tsx` — add OrigemCadastroCard
5. `src/pages/diretoria/RegrasVenda.tsx` — new "Indicação" tab


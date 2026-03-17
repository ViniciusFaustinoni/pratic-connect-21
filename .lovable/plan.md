

## Plan: FIPE Limit Authorization Workflow in Cotador

### Current State
- **`aprovacoes_fipe_menor`** table exists for "lower bracket" approvals — different purpose (1% reduction). Cannot reuse it for limit approvals since it has bracket-specific fields (`fipe_faixa_*`, `valor_mensal_reduzido`).
- **`useConfigLimitesVeiculo`** hook loads `fipe_limite_autorizacao` (R$120K) but not `fipe_limite_autorizacao_moto`. No moto-specific config key exists yet.
- **Submit button** (line 2272) is already conditionally disabled. No FIPE limit check exists anywhere in the cotador.
- **`AprovacoesFipeMenor.tsx`** page at `/vendas/aprovacoes-fipe` handles only FIPE Menor approvals.

### Changes Required

**A) Database — new table `aprovacoes_fipe_limite`**

```sql
CREATE TABLE public.aprovacoes_fipe_limite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  solicitante_id uuid NOT NULL REFERENCES auth.users(id),
  aprovador_id uuid REFERENCES auth.users(id),
  valor_fipe numeric NOT NULL,
  limite_aplicado numeric NOT NULL,
  tipo_veiculo text NOT NULL DEFAULT 'carro',
  veiculo_marca text,
  veiculo_modelo text,
  veiculo_ano integer,
  veiculo_placa text,
  nome_solicitante text,
  justificativa text,
  status text NOT NULL DEFAULT 'pendente',
  observacao_aprovador text,
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

RLS: same pattern as `aprovacoes_fipe_menor` (vendedores see own, supervisors/directors see all, vendedores insert, supervisors update).

Add column to `cotacoes`: `fipe_limite_aprovado boolean DEFAULT null` (null = not needed, true = approved, false = rejected).

Add config key `fipe_limite_autorizacao_moto` with value `30000` to `configuracoes`.

**B) `useConfigLimitesVeiculo.ts` — add moto limit**

Add `fipe_limite_autorizacao_moto` to the CHAVES array and return it as `fipeLimiteAutorizacaoMoto` (default 30000).

**C) New hook `useAprovacoesFipeLimite.ts`**

Similar structure to `useAprovacoesFipeMenor.ts`:
- `useAprovacoesFipeLimite(statusFilter?)` — list approvals with joins to cotacoes/profiles
- `useAprovarFipeLimite()` — approve: set status='aprovado', update `cotacoes.fipe_limite_aprovado = true`
- `useRecusarFipeLimite()` — reject: set status='recusado', update `cotacoes.fipe_limite_aprovado = false`
- `useCriarSolicitacaoFipeLimite()` — create request from cotador

**D) `CotacaoFormDialog.tsx` — add limit check and block**

1. Import `useConfigLimitesVeiculo` and `useCriarSolicitacaoFipeLimite`
2. Derive `limiteAplicavel` based on `tipoVeiculoDetectado`:
   - moto → `fipeLimiteAutorizacaoMoto`
   - carro → `fipeLimiteAutorizacao`
3. Derive `fipeExcedeLimite = valorFipe > limiteAplicavel`
4. When `fipeExcedeLimite`:
   - Show alert: "Este veículo requer autorização prévia..."
   - Show "Solicitar Autorização" button that calls `useCriarSolicitacaoFipeLimite`
   - After request sent, show confirmation message
   - Disable submit button (add `fipeExcedeLimite && !fipeLimiteAprovado` to disabled condition at line 2274)
5. Query existing approval for current cotacao (if editing) to check if already approved

**E) `AprovacoesFipeMenor.tsx` → expand to include FIPE Limite tab**

Add a second section/tab group "Autorização FIPE Alto Valor" that renders cards from `aprovacoes_fipe_limite`. Reuse the same approve/reject dialog pattern. Alternatively, create a separate page component — but since the sidebar already says "Aprovações FIPE", adding a tab is cleaner.

### Files Changed
1. **Database migration**: create `aprovacoes_fipe_limite` table + RLS + add `fipe_limite_aprovado` to cotacoes + insert moto config key
2. **`src/hooks/useConfigLimitesVeiculo.ts`**: add moto limit key
3. **`src/hooks/useAprovacoesFipeLimite.ts`** (new): CRUD hooks for limit approvals
4. **`src/components/cotacoes/CotacaoFormDialog.tsx`**: limit check, alert, block button, request authorization flow
5. **`src/pages/vendas/AprovacoesFipeMenor.tsx`**: add "Alto Valor" tab with approval cards
6. **`src/integrations/supabase/types.ts`**: auto-updated after migration


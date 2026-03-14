

# Plan: Public Zero-Adhesion Page and ASAAS Billing Block

## Overview

When `valor_adesao` is 0 (or below the ASAAS minimum of R$5), the system currently errors out trying to create a billing charge. We need to:
1. Block the ASAAS charge creation when adhesion = R$0
2. Show a celebratory page instead of the payment form

## Changes

### 1. `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx` — Zero-adhesion guard

At the top of the `inicializar` flow (inside the `useEffect` at line ~192), add a check: if `valorAdesao <= 0`, skip billing entirely. Instead:
- Fetch the configured message from `configuracoes` table (`comissao_ext_msg_adesao_zero`) using `publicSupabase`
- Set a new state `adesaoZerada = true` with the message
- Auto-generate the contract (call `gerarContrato`) but skip `criarCobranca`
- Mark the contract's `adesao_paga = true` (since there's nothing to pay)
- Call `onPagamentoConfirmado` after a short delay

When `adesaoZerada` is true, render a celebratory component instead of the payment UI:
- `PartyPopper` icon (already imported in `CotacaoContratacao.tsx`)
- The configured message in large text
- If no message configured, fallback: "Parabens! Sua adesao foi isenta."
- Praticcar logo at the bottom (using the static logo image import)
- "Ir para o aplicativo" button linking to `/app/login`

### 2. `supabase/functions/asaas-cobranca-adesao/index.ts` — Server-side guard

Add an early return at line ~83 (right after parsing the request body): if `valor <= 0`, return a success response with `{ success: true, isento: true }` instead of attempting to create a charge. This is a safety net in case the frontend guard is bypassed.

### 3. No new routes needed

The zero-adhesion UI renders inline within the existing Step 4 (Payment) of `CotacaoContratacao`. No new route or page component is required — it replaces the payment form when `valorAdesao === 0`.

### Technical Details

- The `publicSupabase` client (anon role) is already used in `EtapaPagamentoCotacao` and can read from `configuracoes` if it has a public RLS policy. We need to verify this. If not, we'll fetch the message via the edge function response or add a simple anon-read policy for that specific key.
- The contract auto-creation + `adesao_paga = true` update uses `publicSupabase` which already has write access to `contratos` via existing RLS policies (used in the normal payment flow).
- Both Scenario 2 (volante + zero adhesion) and Scenario 3 (base + zero adhesion) are covered since the check is purely on `valorAdesao`.


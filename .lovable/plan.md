

# Plan: Improve PDF Report and Enable Individual Statement Export

## Overview

Two changes: (1) Enhance the dashboard PDF report with 4 cards summary, opening/closing balances, and per-vendor totals; (2) Enable the disabled "Exportar PDF" button in ContaCorrenteVendedor with filtered export.

---

## 1. `src/components/financeiro/ExportarRelatorioVendaExternaModal.tsx`

Rewrite the `handleExportar` function to include:

**Enhanced "Resumo Geral" section** — render the 4 dashboard cards data:
- A pagar este mês (sum of `status=a_pagar` + `tipo=credito` in current month)
- Antecipações em aberto (sum of `status=antecipado`)
- Débitos pendentes (sum of `status=em_abatimento` + `tipo=debito`)
- Total pago no mês (sum of `status=pago` + `tipo=credito` in current month)

Display these as a 2x2 grid using `autoTable` with colored cells to mirror the dashboard cards.

**Per-vendor section** — for each vendor, add:
- **Saldo inicial do período**: query `cc_vendedor_lancamentos` where `data_lancamento < dataInicio` to compute running balance (sum credits - sum debits with `status != cancelado`)
- **Lançamentos table** (already exists, keep as-is)
- **Saldo final do período**: saldo_inicial + credits - debits within the period
- **Total pago no período**: sum of `valor_liquido` where `status=pago` and `tipo=credito` within the period

This requires one additional query before the main query: fetch all lancamentos before `dataInicio` to calculate opening balance per vendor.

## 2. `src/pages/financeiro/ContaCorrenteVendedor.tsx`

Enable the "Exportar PDF" button (remove `disabled`, add `onClick` handler):

- Import `jsPDF` and `autoTable`
- On click, generate PDF using the current `lancamentos` array (already loaded and filtered)
- PDF content:
  - Header: "Extrato — [vendor name]" + filtered period (if set)
  - Summary: saldo atual, a receber, antecipações (from `saldo` state)
  - Table: all columns from the current view (date, description, type, gross, discount, net, status, balance)
- No additional queries needed — uses already-loaded data

## Technical Notes

- `jsPDF` and `jspdf-autotable` are already project dependencies
- The opening balance query uses the same `cc_vendedor_lancamentos` table with `data_lancamento < dataInicio`
- The ContaCorrenteVendedor export uses in-memory data so it always respects current filters
- Profile name for the vendor header in ContaCorrenteVendedor comes from `profile?.nome` (already available via `useAuth`)


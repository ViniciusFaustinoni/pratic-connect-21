

# Redesign: Equipe Comercial

## Current State

The page has: metrics bar (5 cards), search + period filter + grid/list toggle, consultant cards with ranking, and a detail drawer. It works but has limited sorting/filtering options and the layout feels dense.

## Proposed Changes

### 1. Enhanced Filters & Sorting Bar

Replace the current header with a cleaner toolbar:
- **Search**: keep as-is
- **Period filter**: keep (semana/mes)
- **NEW - Sort selector**: dropdown with options:
  - `ranking` (default) — current behavior (by closed deals desc)
  - `ranking_inverso` — worst performers first (ascending)
  - `alfabetico` — A-Z by name
  - `alfabetico_inverso` — Z-A
  - `valor` — by closed value desc
  - `conversao` — by conversion rate desc
  - `cotacoes` — by active quotes desc
- **NEW - Performance filter**: All / Top Performer / Regular / Atenção
- **View toggle**: keep grid/list
- **Manage button**: keep

All in a single responsive row that wraps on mobile.

### 2. Redesigned Metrics Bar (`PropostasMetricsBar`)

Make it more compact and visually clean:
- Use a single card with a horizontal divider layout instead of 5 separate cards
- Slightly smaller text, tighter spacing
- Keep variation indicators

### 3. Improved Card Design (`ConsultorCardNew`)

- Add a subtle position number on all cards (not just top 3)
- Show a mini progress bar for conversion rate instead of just text
- Cleaner spacing and hierarchy
- Add "cotações realizadas" count

### 4. Improved Table Design (`ConsultoresTable`)

- Add sortable column headers (click to sort)
- Add "Cotações" column
- Highlight rows for top 3 with subtle left border color
- Better responsive behavior

### Files to Edit

| File | Change |
|---|---|
| `src/pages/vendas/Propostas.tsx` | Add sort state, performance filter, pass sorted data |
| `src/components/propostas/ConsultorCardNew.tsx` | Show position on all cards, add progress bar, add cotações |
| `src/components/propostas/ConsultoresTable.tsx` | Add sortable headers, cotações column, top-3 highlights |
| `src/components/propostas/PropostasMetricsBar.tsx` | Compact single-card layout |

No new files needed. No hook changes — sorting is done client-side on the already-fetched data.


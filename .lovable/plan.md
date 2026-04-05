

# Fix: Trajeto do Veículo Não Aparece no Sinistro

## Root Cause

Two problems combine to show "Nenhum trajeto encontrado":

**1. Softruck API `limit=100` is far too low.** The edge function requests trajectories with `limit=100`, which is insufficient for 4 hours of GPS data (typically thousands of points). The API likely returns paginated results and with only 100 allowed, it may return 0 or too few.

**2. The 4h window misses all local data.** The sinistro `SIN-20260405-0018` has `data_ocorrencia = 2026-04-05 01:49 UTC`. The component calculates a window of `21:49 UTC Apr 4` to `01:49 UTC Apr 5`. But the local `rastreador_posicoes` table has data only up to `13:19 UTC Apr 4` — 8.5 hours before the window starts. The fallback query correctly returns 0 rows because no positions exist in that timeframe.

The vehicle was stationary at the collision coordinates (-22.919342, -43.416578) from at least 11:49 UTC onward, with the last collected position at 13:19 UTC. After that, no more positions were collected (rastreador likely went offline).

## Solution

### Change 1: Edge Function `rastreador-historico/index.ts`
- Increase Softruck API limit from `100` to `5000` to capture full trajectory data
- When both API and local fallback return 0 points for the requested window, **expand the search backward** to find the nearest available positions (up to 24h before `data_inicio`). This ensures trajectory data is shown even when the rastreador stopped communicating before the event

### Change 2: Frontend `TrajetoColisaoCard.tsx`
- Expand the default window from 4h to 8h before the collision when no data is found, with an automatic retry
- Show an informational message when displaying data from an expanded period (e.g., "Exibindo trajeto expandido - dados disponíveis até X horas antes do sinistro")

## Technical Details

### Edge Function Changes (`supabase/functions/rastreador-historico/index.ts`)

**Line 132**: Change `limit=100` to `limit=5000`

**After line 352** (fallback local empty): Add an expanded search block:
```
// If both API and local returned 0, try expanding window backward (up to 24h)
if (data_inicio) {
  const expandedStart = new Date(new Date(data_inicio).getTime() - 20 * 3600000).toISOString();
  const { data: expandedData } = await supabase
    .from('rastreador_posicoes')
    .select('*')
    .eq('rastreador_id', rastreador_id)
    .gte('data_posicao', expandedStart)
    .lte('data_posicao', data_fim || fim)
    .order('data_posicao', { ascending: true })
    .limit(2000);

  if (expandedData?.length) {
    // transform and return with expanded period message
  }
}
```

### Frontend Changes (`TrajetoColisaoCard.tsx`)

- When `historico` returns with `trajeto.length === 0`, display the expanded period message from the edge function
- No window change needed on frontend — the edge function handles the expansion automatically

## Files Changed

| File | Action |
|------|--------|
| `supabase/functions/rastreador-historico/index.ts` | Increase API limit to 5000; add expanded fallback search |
| `src/components/sinistros/TrajetoColisaoCard.tsx` | Show expanded period info when returned by API |




## Problem: Tasks don't appear on installer app + big delay

### Root Cause

There is **no Realtime subscription** for the `servicos` table on the installer app. The only mechanisms to detect new tasks are:
- `useTarefaAtual`: polls via `refetchInterval: 30000` (30 seconds)
- `useIniciarServico`: polls every **2 minutes** via `TASK_POLLING_INTERVAL`

Compare this to `useFilasRealtime` and `useChamadosRealtime` which use Supabase Realtime for instant updates on other tables — but nothing equivalent exists for `servicos`.

### Solution

1. **Create `src/hooks/useServicosRealtime.ts`** — A new Realtime hook that subscribes to `postgres_changes` on the `servicos` table filtered by `profissional_id=eq.{userId}`. On any change (INSERT/UPDATE), it instantly invalidates `tarefa-atual`, `servicos`, `servico-detalhes`, and `instalador-instalacoes` queries. Shows a toast on INSERT ("Nova tarefa atribuída!").

2. **Wire it into `InstaladorHome.tsx`** — Call `useServicosRealtime()` at the top of the component (same pattern as `useFilasRealtime` / `useChamadosRealtime` are used elsewhere).

3. **Reduce `useTarefaAtual` polling as fallback** — Change `refetchInterval` from `30000` to `10000` (10s) and `staleTime` from `10000` to `5000`. This serves as a safety net if Realtime misses events.

4. **Reduce `useIniciarServico` polling** — Change `TASK_POLLING_INTERVAL` from `2 * 60 * 1000` (2 min) to `30 * 1000` (30s) for faster fallback when no Realtime event fires.

### Files changed
- **New**: `src/hooks/useServicosRealtime.ts`
- **Edit**: `src/pages/instalador/InstaladorHome.tsx` (add `useServicosRealtime()` call)
- **Edit**: `src/hooks/useTarefaAtual.ts` (reduce refetchInterval to 10s, staleTime to 5s)
- **Edit**: `src/hooks/useIniciarServico.ts` (reduce TASK_POLLING_INTERVAL to 30s)

### Expected result
Tasks appear on the installer's screen **instantly** (via Realtime) instead of waiting 30s-2min. Polling remains as a fallback safety net with shorter intervals.


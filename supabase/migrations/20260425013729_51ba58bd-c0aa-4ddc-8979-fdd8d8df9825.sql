ALTER TABLE public.sga_runtime_state
  ADD COLUMN IF NOT EXISTS backfill_processados_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_ok_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_fail_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_retry_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_lote_atual integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_ultimo_heartbeat timestamptz,
  ADD COLUMN IF NOT EXISTS backfill_cancelar_solicitado boolean NOT NULL DEFAULT false;
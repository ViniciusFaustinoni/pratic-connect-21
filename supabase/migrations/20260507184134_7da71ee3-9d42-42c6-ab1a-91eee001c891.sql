
-- Remove job antigo se existir (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('reconciliar-status-pos-instalacao')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconciliar-status-pos-instalacao');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reconciliar-status-pos-instalacao',
  '*/15 * * * *',
  $$ SELECT public.fn_reconciliar_status_pos_instalacao(); $$
);

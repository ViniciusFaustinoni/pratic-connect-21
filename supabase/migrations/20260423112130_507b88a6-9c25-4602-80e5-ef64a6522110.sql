
-- A. Reagendar cron diário SGA: de 02h BRT (05 UTC) para 09h BRT (12 UTC) + drenagem 12-20h UTC a cada 2h
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  -- Remove cron antigo
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'sga-sync-financeiro-diario';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'sga-sync-financeiro-09h-brt';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'sga-sync-financeiro-drenagem-2h';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'sga-sync-financeiro-09h-brt',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/sga-backfill-massa-orquestrador',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body := '{"acao":"executar_tudo","max_segundos":540,"batch_reconciliacao":80,"batch_financeiro":50}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sga-sync-financeiro-drenagem-2h',
  '0 14-20/2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/sga-backfill-massa-orquestrador',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body := '{"acao":"executar_tudo","max_segundos":540,"batch_reconciliacao":80,"batch_financeiro":50}'::jsonb
  );
  $$
);

-- B. Reagendar 260 jobs em erro por janela horária para pendente_retry (próxima janela 09h BRT amanhã)
UPDATE public.sga_sync_financeiro_jobs
SET status = 'pendente_retry',
    proximo_retry_em = (
      (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) + interval '1 day' + interval '9 hours')
      AT TIME ZONE 'America/Sao_Paulo'
    ),
    updated_at = now()
WHERE status = 'erro' AND ultimo_erro ILIKE '%horari%';

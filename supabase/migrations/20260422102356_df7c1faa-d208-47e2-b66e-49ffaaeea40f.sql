
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='sga-sync-financeiro-diario') THEN
    PERFORM cron.unschedule('sga-sync-financeiro-diario');
  END IF;
END $$;

SELECT cron.schedule(
  'sga-sync-financeiro-diario',
  '0 5 * * *',
  $job$
  SELECT net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-sga-sync-financeiro-diario',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body:='{"trigger":"cron"}'::jsonb
  );
  $job$
);

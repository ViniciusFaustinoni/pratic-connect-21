-- Remove versão antiga se existir, então agenda.
DO $$
BEGIN
  PERFORM cron.unschedule('cron-troca-promocao-gate-5min');
EXCEPTION WHEN OTHERS THEN
  -- ignora se não existia
  NULL;
END $$;

SELECT cron.schedule(
  'cron-troca-promocao-gate-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-troca-promocao-gate',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body:='{"source":"pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
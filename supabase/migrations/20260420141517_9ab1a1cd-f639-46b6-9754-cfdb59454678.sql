-- Desagendar o cron antigo de 30min (se existir, com qualquer um dos nomes históricos)
DO $$
DECLARE
  jobid_var bigint;
BEGIN
  FOR jobid_var IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'cron-reagendamento-automatico-30min',
      'cron-reagendamento-automatico',
      'cron-reagendamento-automatico-5min'
    )
  LOOP
    PERFORM cron.unschedule(jobid_var);
  END LOOP;
END $$;

-- Reagendar a cada 5 minutos
SELECT cron.schedule(
  'cron-reagendamento-automatico-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-reagendamento-automatico',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);
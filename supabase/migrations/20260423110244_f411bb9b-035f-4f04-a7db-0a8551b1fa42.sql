-- Remove jobs antigos com mesmo nome (idempotente)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('sga-reconciliar-codigo-veiculo-10h-brt', 'sga-reconciliar-codigo-veiculo-15h-brt');

-- Agendamento 10h BRT (13h UTC) — segunda a sexta
SELECT cron.schedule(
  'sga-reconciliar-codigo-veiculo-10h-brt',
  '0 13 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-sga-reconciliar-codigo-veiculo',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Agendamento 15h BRT (18h UTC) — segunda a sexta
SELECT cron.schedule(
  'sga-reconciliar-codigo-veiculo-15h-brt',
  '0 18 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-sga-reconciliar-codigo-veiculo',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
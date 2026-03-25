-- Remove any old cron jobs for confirmation functions
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN (
  'confirmar-vespera-18h',
  'confirmar-manha-08h',
  'confirmar-agendamento-1h'
);

-- Véspera: 18h Brasília = 21h UTC
SELECT cron.schedule(
  'confirmar-vespera-18h',
  '0 21 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/confirmar-vistorias-manha-cron',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body := '{"tipo_disparo": "vespera"}'::jsonb
  ) AS request_id;
  $$
);

-- Manhã: 08h Brasília = 11h UTC
SELECT cron.schedule(
  'confirmar-manha-08h',
  '0 11 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/confirmar-vistorias-manha-cron',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body := '{"tipo_disparo": "manha"}'::jsonb
  ) AS request_id;
  $$
);
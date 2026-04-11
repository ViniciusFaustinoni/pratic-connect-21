-- Atualizar cron job da véspera (18h) para disparo manhã (7h BRT = 10h UTC)
-- O job 'confirmar-vespera-18h' agora dispara com tipo_disparo=manha
SELECT cron.unschedule('confirmar-vespera-18h');
SELECT cron.unschedule('confirmar-manha-08h');

-- Novo disparo MANHÃ: 7h Brasília = 10h UTC (1h antes do turno da manhã)
SELECT cron.schedule(
  'confirmar-turno-manha-07h',
  '0 10 * * 1-6',
  $$
  SELECT net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/confirmar-vistorias-manha-cron',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body:='{"tipo_disparo": "manha"}'::jsonb
  ) AS request_id;
  $$
);

-- Novo disparo TARDE: 13h Brasília = 16h UTC (1h antes do turno da tarde)
SELECT cron.schedule(
  'confirmar-turno-tarde-13h',
  '0 16 * * 1-6',
  $$
  SELECT net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/confirmar-vistorias-manha-cron',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body:='{"tipo_disparo": "tarde"}'::jsonb
  ) AS request_id;
  $$
);
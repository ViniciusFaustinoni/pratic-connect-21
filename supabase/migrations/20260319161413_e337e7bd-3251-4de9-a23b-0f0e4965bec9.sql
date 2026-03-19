SELECT cron.unschedule('cron-reagendamento-automatico-18h');

SELECT cron.schedule(
  'cron-reagendamento-automatico-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-reagendamento-automatico',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);
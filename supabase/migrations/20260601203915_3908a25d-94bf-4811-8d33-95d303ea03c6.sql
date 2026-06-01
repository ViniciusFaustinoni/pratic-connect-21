select cron.schedule(
  'reconciliar-ativacao-parcial-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/reconciliar-ativacao-parcial',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body := jsonb_build_object('trigger','cron','at',now())
  ) as request_id;
  $$
);
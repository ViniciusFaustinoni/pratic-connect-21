
select cron.schedule(
  'gerar-despesas-recorrentes-diario',
  '0 6 * * *',
  $$
  select net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-gerar-despesas-recorrentes',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

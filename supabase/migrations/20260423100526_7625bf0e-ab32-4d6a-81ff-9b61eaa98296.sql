-- Garantir extensões para agendamento de jobs HTTP
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remover agendamento anterior (se existir) para idempotência
do $$
begin
  perform cron.unschedule('executar-regua-cobranca-diario');
exception when others then null;
end$$;

-- Agendar execução diária às 09:00 BRT (12:00 UTC)
select cron.schedule(
  'executar-regua-cobranca-diario',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/executar-regua-cobranca',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body := jsonb_build_object('source','cron','at', now()::text)
  ) as request_id;
  $$
);
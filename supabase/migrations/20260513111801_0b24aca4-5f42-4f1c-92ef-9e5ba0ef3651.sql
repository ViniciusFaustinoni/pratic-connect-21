-- Adiar envio de confirmacao de encaixe em 5 minutos
ALTER TABLE confirmacoes_agendamento
  ADD COLUMN IF NOT EXISTS enviar_apos timestamptz,
  ADD COLUMN IF NOT EXISTS payload_disparo jsonb;

CREATE INDEX IF NOT EXISTS idx_confirmacoes_aguardando_disparo
  ON confirmacoes_agendamento (enviar_apos)
  WHERE status = 'aguardando_disparo';

-- Cron a cada 1 minuto
SELECT cron.unschedule('disparar-encaixes-pendentes')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='disparar-encaixes-pendentes');

SELECT cron.schedule(
  'disparar-encaixes-pendentes',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-disparar-encaixes',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI'
    ),
    body := jsonb_build_object('source','cron')
  );
  $$
);
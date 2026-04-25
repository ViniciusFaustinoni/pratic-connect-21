-- Remove cron antigo de drenagem (2h)
SELECT cron.unschedule('sga-sync-financeiro-drenagem-2h')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sga-sync-financeiro-drenagem-2h');

-- Remove cron novo se já existir (idempotência)
SELECT cron.unschedule('sga-sync-financeiro-drenagem-5min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sga-sync-financeiro-drenagem-5min');

-- Cria cron de 5 minutos dentro da janela horária liberada
-- 09h–01h UTC cobre 06h–22h BRT (UTC-3)
SELECT cron.schedule(
  'sga-sync-financeiro-drenagem-5min',
  '*/5 9-23,0-1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-sga-sync-financeiro-diario',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body := jsonb_build_object('apenas_processar', true, 'origem', 'cron_5min')
  );
  $$
);
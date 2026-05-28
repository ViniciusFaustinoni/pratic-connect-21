-- 1) Hotfix LTC8G02: zera placeholder + agenda reativação no próximo cron
UPDATE rastreadores
SET plataforma_device_id = NULL,
    id_plataforma = NULL,
    softruck_response_raw = NULL,
    softruck_integration_status = 'PENDING',
    softruck_tentativas = 0,
    softruck_last_attempt_at = NULL,
    updated_at = now()
WHERE id = '9ac6603f-1a16-4596-801b-fe4661379232'
  AND plataforma_device_id = imei;

-- 2) Saneamento em massa: outros rastreadores com plataforma_device_id = IMEI (placeholder)
UPDATE rastreadores
SET plataforma_device_id = NULL,
    id_plataforma = CASE WHEN id_plataforma = imei THEN NULL ELSE id_plataforma END,
    softruck_integration_status = 'PENDING',
    softruck_last_attempt_at = NULL,
    updated_at = now()
WHERE plataforma = 'softruck'
  AND status = 'instalado'
  AND plataforma_device_id IS NOT NULL
  AND plataforma_device_id = imei
  AND softruck_integration_status IS DISTINCT FROM 'SUCCESS';

-- 3) Habilitar pg_cron + pg_net se ainda não estiverem
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 4) Agendar cron a cada 10 minutos
DO $$
BEGIN
  PERFORM cron.unschedule('softruck-reconciliar-pending-10min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'softruck-reconciliar-pending-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-softruck-reconciliar-pending',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI'
    ),
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);
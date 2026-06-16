-- =============================================
-- CONTAS A PAGAR — Lembretes de vencimento via WhatsApp
-- =============================================

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS lembrete_vespera_enviado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lembrete_dia_enviado BOOLEAN NOT NULL DEFAULT false;

-- CRON: lembrete de contas a pagar (véspera + dia) — 11:30 UTC ≈ 08:30 BRT
DO $$ BEGIN
  PERFORM cron.unschedule('contas-pagar-lembrete-vencimento');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'contas-pagar-lembrete-vencimento',
  '30 11 * * *',
  $$
  SELECT net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-contas-pagar-lembrete-vencimento',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

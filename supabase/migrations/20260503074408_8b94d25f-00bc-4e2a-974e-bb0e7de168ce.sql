
-- Fase 1: tracking de lembretes de coparticipação no sinistro
ALTER TABLE public.sinistros
  ADD COLUMN IF NOT EXISTS cota_data_geracao timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cota_lembrete_ultimo_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cota_lembretes_enviados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cota_expirada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cota_expirada_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS aguardando_pagamento_cota boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sinistros_cota_pendente
  ON public.sinistros (aguardando_pagamento_cota, cota_paga, cota_expirada)
  WHERE aguardando_pagamento_cota = true AND cota_paga = false AND cota_expirada = false;

-- pg_cron job: lembrete de coparticipação a cada dia (a função decide quem disparar 3/3 dias)
DO $$
DECLARE
  v_anon_key text;
BEGIN
  -- Garantir extensões
  PERFORM 1 FROM pg_extension WHERE extname = 'pg_cron';
  IF NOT FOUND THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
  PERFORM 1 FROM pg_extension WHERE extname = 'pg_net';
  IF NOT FOUND THEN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  END IF;
END$$;

-- Remover job anterior, se existir
DO $$
BEGIN
  PERFORM cron.unschedule('cron-lembrete-coparticipacao');
EXCEPTION WHEN OTHERS THEN
  NULL;
END$$;

SELECT cron.schedule(
  'cron-lembrete-coparticipacao',
  '0 13 * * *', -- 10h BRT diariamente
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-lembrete-coparticipacao',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

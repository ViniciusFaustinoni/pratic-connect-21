-- Add lifecycle and location columns to vistoria_prestador_links
ALTER TABLE public.vistoria_prestador_links
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS precisao_metros double precision,
  ADD COLUMN IF NOT EXISTS localizacao_atualizada_em timestamptz,
  ADD COLUMN IF NOT EXISTS aceito_em timestamptz,
  ADD COLUMN IF NOT EXISTS recusado_em timestamptz,
  ADD COLUMN IF NOT EXISTS recusa_motivo text,
  ADD COLUMN IF NOT EXISTS em_rota_em timestamptz,
  ADD COLUMN IF NOT EXISTS iniciada_em timestamptz;

-- Same for instalacao_prestador_links
ALTER TABLE public.instalacao_prestador_links
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS precisao_metros double precision,
  ADD COLUMN IF NOT EXISTS localizacao_atualizada_em timestamptz,
  ADD COLUMN IF NOT EXISTS aceito_em timestamptz,
  ADD COLUMN IF NOT EXISTS recusado_em timestamptz,
  ADD COLUMN IF NOT EXISTS recusa_motivo text,
  ADD COLUMN IF NOT EXISTS em_rota_em timestamptz,
  ADD COLUMN IF NOT EXISTS iniciada_em timestamptz;

-- Indexes for realtime map queries
CREATE INDEX IF NOT EXISTS idx_vistoria_prest_links_status_loc
  ON public.vistoria_prestador_links (status, localizacao_atualizada_em DESC)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_instalacao_prest_links_status_loc
  ON public.instalacao_prestador_links (status, localizacao_atualizada_em DESC)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Enable realtime
ALTER TABLE public.vistoria_prestador_links REPLICA IDENTITY FULL;
ALTER TABLE public.instalacao_prestador_links REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vistoria_prestador_links;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.instalacao_prestador_links;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
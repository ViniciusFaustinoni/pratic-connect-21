ALTER TABLE public.vistoria_prestador_links
  ALTER COLUMN instalacao_id DROP NOT NULL;

ALTER TABLE public.vistoria_prestador_links
  ADD COLUMN IF NOT EXISTS vistoria_id uuid REFERENCES public.vistorias(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vistoria_prestador_links_origem_check'
  ) THEN
    ALTER TABLE public.vistoria_prestador_links
      ADD CONSTRAINT vistoria_prestador_links_origem_check
      CHECK (instalacao_id IS NOT NULL OR vistoria_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vistoria_prestador_links_vistoria_id
  ON public.vistoria_prestador_links(vistoria_id)
  WHERE vistoria_id IS NOT NULL;
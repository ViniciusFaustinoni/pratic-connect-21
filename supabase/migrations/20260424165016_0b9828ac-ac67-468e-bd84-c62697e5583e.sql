ALTER TABLE public.instalacao_prestador_links
  ADD COLUMN IF NOT EXISTS valor numeric(12,2),
  ADD COLUMN IF NOT EXISTS atribuido_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_instalacao_prestador_links_atribuido_por
  ON public.instalacao_prestador_links(atribuido_por);
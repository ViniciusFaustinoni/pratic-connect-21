ALTER TABLE public.ordens_servico_itens
  ADD COLUMN IF NOT EXISTS area_impacto text,
  ADD COLUMN IF NOT EXISTS operacao text,
  ADD COLUMN IF NOT EXISTS horas numeric,
  ADD COLUMN IF NOT EXISTS flags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS peca_pai_id uuid REFERENCES public.ordens_servico_itens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_osi_peca_pai ON public.ordens_servico_itens(peca_pai_id);
CREATE INDEX IF NOT EXISTS idx_osi_area_impacto ON public.ordens_servico_itens(area_impacto);

ALTER TABLE public.vistorias_evento
  ADD COLUMN IF NOT EXISTS dados_orcamento jsonb,
  ADD COLUMN IF NOT EXISTS orcamento_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vistorias_evento_orcamento_hash
  ON public.vistorias_evento(id, orcamento_hash)
  WHERE orcamento_hash IS NOT NULL;
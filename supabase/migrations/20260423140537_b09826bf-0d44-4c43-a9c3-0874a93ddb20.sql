ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS substituida_por_cotacao_id uuid REFERENCES public.cotacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_substituicao text;

CREATE INDEX IF NOT EXISTS idx_cotacoes_substituida_por
  ON public.cotacoes(substituida_por_cotacao_id);
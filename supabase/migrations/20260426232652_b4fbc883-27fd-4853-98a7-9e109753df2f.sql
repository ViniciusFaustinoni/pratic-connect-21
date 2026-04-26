ALTER TABLE public.vistoria_links
  ADD COLUMN IF NOT EXISTS fotos_aprovadas_em timestamptz,
  ADD COLUMN IF NOT EXISTS fotos_aprovadas_por uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS fotos_reprovadas_em timestamptz,
  ADD COLUMN IF NOT EXISTS fotos_reprovadas_por uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS fotos_reprovacao_motivo text;

-- Índice para fila de aprovação (fotos concluídas e ainda não aprovadas/reprovadas)
CREATE INDEX IF NOT EXISTS idx_vistoria_links_fotos_aguardando_aprovacao
  ON public.vistoria_links (fotos_concluida_em DESC)
  WHERE fotos_etapa_status = 'concluida'
    AND fotos_aprovadas_em IS NULL
    AND fotos_reprovadas_em IS NULL;
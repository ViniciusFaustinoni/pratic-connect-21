ALTER TABLE public.ia_habilidade_conhecimento
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'conhecimento'
    CHECK (tipo IN ('conhecimento','regra'));

CREATE INDEX IF NOT EXISTS idx_ia_habilidade_conhecimento_slug_tipo
  ON public.ia_habilidade_conhecimento(habilidade_slug, tipo);

UPDATE public.ia_habilidade_conhecimento
   SET tipo = 'regra'
 WHERE habilidade_slug = 'relacionamento'
   AND categoria IN ('formatacao','boletos','sinistro');
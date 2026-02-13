ALTER TABLE public.documento_templates
  ADD COLUMN IF NOT EXISTS is_default_saida BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_default_saida
  ON public.documento_templates (is_default_saida)
  WHERE is_default_saida = true AND ativo = true;
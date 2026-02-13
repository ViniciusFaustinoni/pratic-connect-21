ALTER TABLE public.documento_templates
  ADD COLUMN IF NOT EXISTS is_default_evento BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_default_evento
  ON public.documento_templates (is_default_evento)
  WHERE is_default_evento = true AND ativo = true;
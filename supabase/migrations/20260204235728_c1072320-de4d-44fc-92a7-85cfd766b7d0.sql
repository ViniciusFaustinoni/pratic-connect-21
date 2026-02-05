-- Adicionar campo para marcar template como padrão para Autentique
ALTER TABLE public.documento_templates
  ADD COLUMN IF NOT EXISTS is_default_autentique BOOLEAN DEFAULT false;

-- Armazenar HTML compilado (opcional, para cache)
ALTER TABLE public.documento_templates
  ADD COLUMN IF NOT EXISTS template_html TEXT;

-- Garantir unicidade do template padrão (apenas um pode ser padrão)
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_default_autentique 
  ON public.documento_templates (is_default_autentique) 
  WHERE is_default_autentique = true AND ativo = true;
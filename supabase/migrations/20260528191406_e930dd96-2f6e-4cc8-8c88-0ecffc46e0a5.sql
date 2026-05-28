ALTER TABLE public.email_suspensao_templates
  ADD COLUMN IF NOT EXISTS formato text NOT NULL DEFAULT 'html';

ALTER TABLE public.email_suspensao_templates
  DROP CONSTRAINT IF EXISTS email_suspensao_templates_formato_check;

ALTER TABLE public.email_suspensao_templates
  ADD CONSTRAINT email_suspensao_templates_formato_check
  CHECK (formato IN ('html','texto'));

-- backfill: templates pré-existentes nasceram como texto puro
UPDATE public.email_suspensao_templates
  SET formato = 'texto'
  WHERE created_at < now() AND formato = 'html';
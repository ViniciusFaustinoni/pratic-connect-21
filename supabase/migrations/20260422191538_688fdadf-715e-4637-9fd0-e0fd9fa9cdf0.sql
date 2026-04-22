ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS dados_extraidos jsonb,
  ADD COLUMN IF NOT EXISTS tipo_detectado text,
  ADD COLUMN IF NOT EXISTS confianca_ocr numeric,
  ADD COLUMN IF NOT EXISTS sugestao_ocr text;
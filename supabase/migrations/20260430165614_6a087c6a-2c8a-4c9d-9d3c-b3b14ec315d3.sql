
-- 1) Estender ai_provider_keys para aceitar 'mistral'
ALTER TABLE public.ai_provider_keys
  DROP CONSTRAINT IF EXISTS ai_provider_keys_provider_check;
ALTER TABLE public.ai_provider_keys
  ADD CONSTRAINT ai_provider_keys_provider_check
  CHECK (provider IN ('openai','anthropic','mistral'));

-- Atualizar função de status para incluir mistral
CREATE OR REPLACE FUNCTION public.ai_provider_keys_status()
RETURNS TABLE(provider text, configured boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.provider,
         EXISTS(SELECT 1 FROM public.ai_provider_keys k WHERE k.provider = p.provider) AS configured
  FROM (VALUES ('openai'),('anthropic'),('mistral')) AS p(provider);
$$;

-- 2) Tabela ocr_engine_config (singleton)
CREATE TABLE IF NOT EXISTS public.ocr_engine_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine text NOT NULL DEFAULT 'global'
    CHECK (engine IN ('global','mistral','anthropic','google')),
  primary_model text NOT NULL DEFAULT 'mistral-ocr-latest',
  secondary_model text DEFAULT 'claude-sonnet-4-5',
  dupla_leitura_tipos text[] NOT NULL DEFAULT ARRAY['cnh','crlv'],
  pdf_rasterizar boolean NOT NULL DEFAULT true,
  pdf_dpi int NOT NULL DEFAULT 200,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.ocr_engine_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocr_engine_config_select_authenticated" ON public.ocr_engine_config;
CREATE POLICY "ocr_engine_config_select_authenticated"
ON public.ocr_engine_config FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "ocr_engine_config_modify_diretor_dev" ON public.ocr_engine_config;
CREATE POLICY "ocr_engine_config_modify_diretor_dev"
ON public.ocr_engine_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'desenvolvedor'))
WITH CHECK (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'desenvolvedor'));

CREATE OR REPLACE FUNCTION public.touch_ocr_engine_config()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_ocr_engine_config ON public.ocr_engine_config;
CREATE TRIGGER trg_touch_ocr_engine_config
BEFORE UPDATE ON public.ocr_engine_config
FOR EACH ROW EXECUTE FUNCTION public.touch_ocr_engine_config();

-- Linha default
INSERT INTO public.ocr_engine_config (engine, primary_model, secondary_model)
SELECT 'global', 'mistral-ocr-latest', 'claude-sonnet-4-5'
WHERE NOT EXISTS (SELECT 1 FROM public.ocr_engine_config);

-- 3) Enriquecer ocr_execution_logs
ALTER TABLE public.ocr_execution_logs
  ADD COLUMN IF NOT EXISTS engine text,
  ADD COLUMN IF NOT EXISTS primary_model text,
  ADD COLUMN IF NOT EXISTS secondary_model text,
  ADD COLUMN IF NOT EXISTS dupla_leitura boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS divergencias jsonb,
  ADD COLUMN IF NOT EXISTS pdf_rasterizado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdf_paginas_rasterizadas int;

COMMENT ON COLUMN public.ocr_execution_logs.engine IS 'Motor de OCR usado: mistral|anthropic|google|global';
COMMENT ON COLUMN public.ocr_execution_logs.primary_model IS 'Modelo da 1a passada (real, nao mais hardcoded)';
COMMENT ON COLUMN public.ocr_execution_logs.secondary_model IS 'Modelo da 2a passada (dupla leitura ou retry)';
COMMENT ON COLUMN public.ocr_execution_logs.dupla_leitura IS 'Documento passou por dupla leitura (CNH/CRLV)';
COMMENT ON COLUMN public.ocr_execution_logs.divergencias IS 'Diff de campos criticos entre passadas A e B';
COMMENT ON COLUMN public.ocr_execution_logs.pdf_rasterizado IS 'PDF foi convertido para JPEG antes do envio a IA';

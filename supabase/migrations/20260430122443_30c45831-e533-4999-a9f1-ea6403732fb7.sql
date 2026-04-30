ALTER TABLE public.ocr_execution_logs
  ADD COLUMN IF NOT EXISTS cpf_contexto TEXT,
  ADD COLUMN IF NOT EXISTS cpf_fonte TEXT,
  ADD COLUMN IF NOT EXISTS cpf_candidatos JSONB;

COMMENT ON COLUMN public.ocr_execution_logs.cpf_contexto IS 'Trecho do texto nativo do PDF ao redor do rotulo CPF (debug)';
COMMENT ON COLUMN public.ocr_execution_logs.cpf_fonte IS 'Fonte final do CPF: native_anchored | native_first_valid | ia | ia_retry | permutacao | none';
COMMENT ON COLUMN public.ocr_execution_logs.cpf_candidatos IS 'Lista de CPFs candidatos encontrados no documento (debug)';
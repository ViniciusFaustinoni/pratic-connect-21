-- Adicionar colunas para validação de chassi via OCR
ALTER TABLE public.vistorias 
ADD COLUMN IF NOT EXISTS chassi_ocr TEXT,
ADD COLUMN IF NOT EXISTS chassi_ocr_confianca NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS chassi_validacao TEXT;

-- Adicionar comentários explicativos
COMMENT ON COLUMN public.vistorias.chassi_ocr IS 'Chassi extraído da foto via OCR';
COMMENT ON COLUMN public.vistorias.chassi_ocr_confianca IS 'Confiança da extração OCR (0 a 100)';
COMMENT ON COLUMN public.vistorias.chassi_validacao IS 'Resultado da comparação: confere, diverge ou ilegivel';
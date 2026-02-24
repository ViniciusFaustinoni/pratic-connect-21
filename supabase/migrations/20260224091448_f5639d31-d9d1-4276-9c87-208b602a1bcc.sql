-- Add tipo and dados_extras columns to sinistro_analises_ia
ALTER TABLE public.sinistro_analises_ia 
ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'risco_fraude',
ADD COLUMN IF NOT EXISTS dados_extras jsonb DEFAULT null;

-- Add index for fast lookup by tipo
CREATE INDEX IF NOT EXISTS idx_sinistro_analises_ia_tipo 
ON public.sinistro_analises_ia(sinistro_id, tipo);

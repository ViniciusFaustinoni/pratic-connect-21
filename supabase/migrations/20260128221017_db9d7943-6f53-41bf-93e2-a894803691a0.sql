-- 1. Adicionar status em_sindicancia ao enum status_sinistro (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'em_sindicancia' AND enumtypid = 'status_sinistro'::regtype) THEN
    ALTER TYPE status_sinistro ADD VALUE 'em_sindicancia';
  END IF;
END $$;

-- 2. Adicionar campo tipo_dano com constraint
ALTER TABLE public.sinistros 
ADD COLUMN IF NOT EXISTS tipo_dano TEXT 
CHECK (tipo_dano IS NULL OR tipo_dano IN ('parcial', 'perda_total'));

-- 3. Adicionar campo valor_participacao
ALTER TABLE public.sinistros 
ADD COLUMN IF NOT EXISTS valor_participacao NUMERIC(12,2) DEFAULT 0;

-- 4. Adicionar indice para tipo_dano
CREATE INDEX IF NOT EXISTS idx_sinistros_tipo_dano 
ON public.sinistros(tipo_dano) 
WHERE tipo_dano IS NOT NULL;

-- 5. Adicionar comentários para documentação
COMMENT ON COLUMN public.sinistros.tipo_dano IS 'Classificação do dano: parcial (<75% FIPE) ou perda_total (>=75% FIPE)';
COMMENT ON COLUMN public.sinistros.valor_participacao IS 'Valor da participação do associado (dedutível)';
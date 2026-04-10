ALTER TABLE public.veiculos 
ADD COLUMN IF NOT EXISTS cobertura_suspensa boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cobertura_suspensa_motivo text,
ADD COLUMN IF NOT EXISTS cobertura_suspensa_em timestamptz;
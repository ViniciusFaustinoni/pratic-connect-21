-- Add tipo_uso column to plans table
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS tipo_uso TEXT NOT NULL DEFAULT 'passeio';

-- Add comment for documentation
COMMENT ON COLUMN public.plans.tipo_uso IS 'Tipo de cliente: passeio (particular) ou aplicativo (Uber, 99, etc)';
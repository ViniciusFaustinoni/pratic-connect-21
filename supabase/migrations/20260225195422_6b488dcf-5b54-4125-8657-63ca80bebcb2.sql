ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS codigo_fipe text;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS uso_aplicativo boolean;
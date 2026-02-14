
-- Add reboque columns to sinistros
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS necessita_reboque boolean DEFAULT null;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS chamado_assistencia_id uuid REFERENCES public.chamados_assistencia(id) DEFAULT null;

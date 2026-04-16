-- Add oficina_id column to agendamentos_base
ALTER TABLE public.agendamentos_base
ADD COLUMN oficina_id UUID REFERENCES public.oficinas(id);

-- Update existing records to point to Duque de Caxias base
UPDATE public.agendamentos_base
SET oficina_id = '41ef21e6-8d8e-487f-b6b5-8b26e4653790'
WHERE oficina_id IS NULL;
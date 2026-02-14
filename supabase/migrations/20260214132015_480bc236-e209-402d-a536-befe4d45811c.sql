
-- Add warranty return reference column
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS retorno_garantia_os_id uuid REFERENCES public.ordens_servico(id);

-- Add index for warranty returns
CREATE INDEX IF NOT EXISTS idx_ordens_servico_retorno_garantia ON public.ordens_servico(retorno_garantia_os_id) WHERE retorno_garantia_os_id IS NOT NULL;

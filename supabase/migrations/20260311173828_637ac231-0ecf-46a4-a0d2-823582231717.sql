-- Add regiao column to cotacoes_publicas
ALTER TABLE public.cotacoes_publicas 
ADD COLUMN IF NOT EXISTS regiao text DEFAULT 'rj';

-- Add comment
COMMENT ON COLUMN public.cotacoes_publicas.regiao IS 'Região para precificação (rj, lagos, sp)';
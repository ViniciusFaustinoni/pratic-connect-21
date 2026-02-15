
-- Adicionar colunas na tabela rastreador_alertas
ALTER TABLE public.rastreador_alertas 
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.veiculos(id),
  ADD COLUMN IF NOT EXISTS dados_extras jsonb;

-- Tornar rastreador_id nullable (para alertas de veículo sem rastreador)
ALTER TABLE public.rastreador_alertas 
  ALTER COLUMN rastreador_id DROP NOT NULL;

-- Índice para busca por veiculo_id
CREATE INDEX IF NOT EXISTS idx_rastreador_alertas_veiculo_id ON public.rastreador_alertas(veiculo_id);

-- Índice para busca por status
CREATE INDEX IF NOT EXISTS idx_rastreador_alertas_status ON public.rastreador_alertas(status);

-- Índice para busca por tipo
CREATE INDEX IF NOT EXISTS idx_rastreador_alertas_tipo ON public.rastreador_alertas(tipo);

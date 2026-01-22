-- Adicionar colunas para IDs da plataforma Softruck

-- Na tabela rastreadores: ID do veículo na plataforma Softruck
ALTER TABLE public.rastreadores 
ADD COLUMN IF NOT EXISTS plataforma_veiculo_id VARCHAR(20);

COMMENT ON COLUMN public.rastreadores.plataforma_veiculo_id IS 
  'ID do veículo na plataforma de rastreamento (ex: Softruck vehicle ID)';

-- Na tabela veiculos: ID do veículo na Softruck (para rastreabilidade direta)
ALTER TABLE public.veiculos 
ADD COLUMN IF NOT EXISTS softruck_vehicle_id VARCHAR(20);

COMMENT ON COLUMN public.veiculos.softruck_vehicle_id IS 
  'ID do veículo na plataforma Softruck (15 chars alphanum)';

-- Índices para buscas eficientes
CREATE INDEX IF NOT EXISTS idx_rastreadores_plat_veiculo 
ON public.rastreadores(plataforma_veiculo_id) 
WHERE plataforma_veiculo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_veiculos_softruck_id 
ON public.veiculos(softruck_vehicle_id) 
WHERE softruck_vehicle_id IS NOT NULL;
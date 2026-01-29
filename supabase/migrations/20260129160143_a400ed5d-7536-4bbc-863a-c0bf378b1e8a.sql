-- Adicionar campos para IDs da plataforma Rede Veículos na tabela veiculos
ALTER TABLE public.veiculos 
  ADD COLUMN IF NOT EXISTS rede_veiculos_cliente_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS rede_veiculos_veiculo_id VARCHAR(50);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.veiculos.rede_veiculos_cliente_id IS 'ID do cliente na plataforma Rede Veículos';
COMMENT ON COLUMN public.veiculos.rede_veiculos_veiculo_id IS 'ID do veículo na plataforma Rede Veículos';
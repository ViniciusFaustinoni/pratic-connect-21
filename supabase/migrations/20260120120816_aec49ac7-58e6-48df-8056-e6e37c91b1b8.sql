-- Adicionar coluna veiculo_cor na tabela cotacoes
ALTER TABLE public.cotacoes 
ADD COLUMN IF NOT EXISTS veiculo_cor VARCHAR(50);

-- Adicionar coluna veiculo_cor na tabela leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS veiculo_cor TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.cotacoes.veiculo_cor IS 'Cor do veículo obtida na consulta de placa';
COMMENT ON COLUMN public.leads.veiculo_cor IS 'Cor do veículo obtida na consulta de placa';
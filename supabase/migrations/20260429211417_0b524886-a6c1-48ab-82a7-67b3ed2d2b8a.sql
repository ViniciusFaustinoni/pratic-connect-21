-- Adicionar coluna numero_portas em cotacoes e contratos para refletir o CRLV/API de placa
ALTER TABLE public.cotacoes ADD COLUMN IF NOT EXISTS numero_portas INTEGER;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS veiculo_numero_portas INTEGER;

COMMENT ON COLUMN public.cotacoes.numero_portas IS 'Número de portas do veículo conforme retornado pela plate-lookup/CRLV. NULL quando não disponível — termo deve mostrar "—" e nunca chutar valor.';
COMMENT ON COLUMN public.contratos.veiculo_numero_portas IS 'Número de portas copiado da cotação no momento da geração do contrato. NULL quando não disponível.';
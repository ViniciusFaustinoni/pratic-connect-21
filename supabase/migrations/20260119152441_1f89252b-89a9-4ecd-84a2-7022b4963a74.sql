-- Adicionar campos de cobertura e motivo de recusa na tabela veiculos
ALTER TABLE veiculos 
ADD COLUMN IF NOT EXISTS cobertura_roubo_furto BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cobertura_total BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS motivo_recusa_veiculo TEXT,
ADD COLUMN IF NOT EXISTS recusado_por UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS recusado_em TIMESTAMP WITH TIME ZONE;

-- Comentários para documentação
COMMENT ON COLUMN veiculos.cobertura_roubo_furto IS 'Cobertura parcial aprovada pelo analista de cadastro após autovistoria';
COMMENT ON COLUMN veiculos.cobertura_total IS 'Cobertura total aprovada pelo técnico instalador após vistoria de entrada';
COMMENT ON COLUMN veiculos.motivo_recusa_veiculo IS 'Motivo da recusa do veículo pelo técnico instalador';
COMMENT ON COLUMN veiculos.recusado_por IS 'ID do usuário que recusou o veículo';
COMMENT ON COLUMN veiculos.recusado_em IS 'Data e hora da recusa do veículo';
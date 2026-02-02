-- Adicionar campos de integração Softruck na tabela rastreadores
ALTER TABLE rastreadores 
ADD COLUMN IF NOT EXISTS chip_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS softruck_chip_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS softruck_integration_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS softruck_last_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS softruck_payload_sent JSONB,
ADD COLUMN IF NOT EXISTS softruck_response_raw JSONB;

-- Adicionar campo plataforma_veiculo_id se não existir
ALTER TABLE rastreadores
ADD COLUMN IF NOT EXISTS plataforma_veiculo_id VARCHAR(100);

-- Comentários para documentação
COMMENT ON COLUMN rastreadores.softruck_integration_status IS 
  'Status: PENDING | SUCCESS | FAILED_AUTH | FAILED_VEHICLE | FAILED_CHIP | FAILED_DEVICE | FAILED_ASSOCIATION | CREATED_BUT_NOT_ACTIVATED';

COMMENT ON COLUMN rastreadores.chip_number IS 'Número de telefone/linha do chip SIM';
COMMENT ON COLUMN rastreadores.softruck_chip_id IS 'ID do chip na plataforma Softruck';
COMMENT ON COLUMN rastreadores.softruck_last_attempt_at IS 'Data/hora da última tentativa de integração';
COMMENT ON COLUMN rastreadores.softruck_payload_sent IS 'Payload JSON enviado na última integração';
COMMENT ON COLUMN rastreadores.softruck_response_raw IS 'Resposta JSON recebida na última integração';
COMMENT ON COLUMN rastreadores.plataforma_veiculo_id IS 'ID do veículo na plataforma externa (Softruck/Rede Veículos)';
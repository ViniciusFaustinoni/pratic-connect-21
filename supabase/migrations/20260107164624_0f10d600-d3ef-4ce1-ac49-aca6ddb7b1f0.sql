-- Add column for password reset support in platforms config
ALTER TABLE rastreadores_config_plataformas 
ADD COLUMN IF NOT EXISTS suporta_redefinir_senha BOOLEAN DEFAULT FALSE;

-- Update existing platforms to support password reset
UPDATE rastreadores_config_plataformas 
SET suporta_redefinir_senha = TRUE 
WHERE plataforma IN ('softruck', 'rede_veiculos');

-- Add column for platform user ID in rastreadores (needed for Softruck)
ALTER TABLE rastreadores 
ADD COLUMN IF NOT EXISTS plataforma_user_id VARCHAR(100);

COMMENT ON COLUMN rastreadores.plataforma_user_id IS 'ID do usuário do cliente na plataforma de rastreamento (necessário para Softruck)';
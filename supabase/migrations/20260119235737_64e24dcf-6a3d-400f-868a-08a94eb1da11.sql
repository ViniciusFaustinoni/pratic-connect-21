-- Adicionar coluna modulo para categorizar logs por área do sistema
ALTER TABLE auth_logs ADD COLUMN IF NOT EXISTS modulo text;

-- Criar índice para filtrar logs por módulo
CREATE INDEX IF NOT EXISTS idx_auth_logs_modulo ON auth_logs(modulo);

-- Criar índice composto para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_modulo ON auth_logs(created_at DESC, modulo);
-- Adicionar colunas para dados do solicitante independente de lead
ALTER TABLE cotacoes
ADD COLUMN IF NOT EXISTS nome_solicitante VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_solicitante VARCHAR(255),
ADD COLUMN IF NOT EXISTS telefone1_solicitante VARCHAR(20),
ADD COLUMN IF NOT EXISTS telefone2_solicitante VARCHAR(20);

-- Comentários para documentação
COMMENT ON COLUMN cotacoes.nome_solicitante IS 'Nome do solicitante (independente de lead)';
COMMENT ON COLUMN cotacoes.email_solicitante IS 'E-mail do solicitante (opcional)';
COMMENT ON COLUMN cotacoes.telefone1_solicitante IS 'Telefone principal do solicitante (opcional)';
COMMENT ON COLUMN cotacoes.telefone2_solicitante IS 'Telefone secundário do solicitante (opcional)';
-- Adicionar campos para agendamento da vistoria completa (após autovistoria)
ALTER TABLE cotacoes
ADD COLUMN IF NOT EXISTS vistoria_completa_data_agendada DATE,
ADD COLUMN IF NOT EXISTS vistoria_completa_horario_agendado TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_endereco_cep TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_endereco_logradouro TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_endereco_numero TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_endereco_bairro TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_endereco_cidade TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_endereco_estado TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_responsavel_eu_mesmo BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS vistoria_completa_responsavel_nome TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_responsavel_telefone TEXT;

-- Comentários para documentação
COMMENT ON COLUMN cotacoes.vistoria_completa_data_agendada IS 'Data agendada para vistoria completa (após autovistoria para cobertura total)';
COMMENT ON COLUMN cotacoes.vistoria_completa_horario_agendado IS 'Horário agendado para vistoria completa';
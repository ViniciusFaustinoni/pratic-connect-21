-- Campos para agendamento de vistoria presencial
ALTER TABLE cotacoes
ADD COLUMN IF NOT EXISTS vistoria_data_agendada DATE,
ADD COLUMN IF NOT EXISTS vistoria_horario_agendado TEXT,
ADD COLUMN IF NOT EXISTS vistoria_endereco_cep TEXT,
ADD COLUMN IF NOT EXISTS vistoria_endereco_logradouro TEXT,
ADD COLUMN IF NOT EXISTS vistoria_endereco_numero TEXT,
ADD COLUMN IF NOT EXISTS vistoria_endereco_bairro TEXT,
ADD COLUMN IF NOT EXISTS vistoria_endereco_cidade TEXT,
ADD COLUMN IF NOT EXISTS vistoria_endereco_estado TEXT,
ADD COLUMN IF NOT EXISTS vistoria_responsavel_eu_mesmo BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS vistoria_responsavel_nome TEXT,
ADD COLUMN IF NOT EXISTS vistoria_responsavel_telefone TEXT;
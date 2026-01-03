-- Adicionar novo valor ao enum status_vistoria
ALTER TYPE status_vistoria ADD VALUE IF NOT EXISTS 'agendada';

-- Adicionar colunas para agendamento de sinistro
ALTER TABLE vistorias
ADD COLUMN IF NOT EXISTS sinistro_id uuid REFERENCES sinistros(id),
ADD COLUMN IF NOT EXISTS data_agendada timestamp with time zone,
ADD COLUMN IF NOT EXISTS endereco_logradouro text,
ADD COLUMN IF NOT EXISTS endereco_cidade text,
ADD COLUMN IF NOT EXISTS endereco_estado text,
ADD COLUMN IF NOT EXISTS observacoes text;

-- Criar indice para busca por sinistro
CREATE INDEX IF NOT EXISTS idx_vistorias_sinistro_id ON vistorias(sinistro_id);
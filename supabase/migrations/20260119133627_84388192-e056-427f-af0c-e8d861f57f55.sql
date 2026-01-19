-- Adicionar colunas de coordenadas nas tabelas que ainda não têm

-- Tabela instalacoes
ALTER TABLE instalacoes 
ADD COLUMN IF NOT EXISTS endereco_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS endereco_longitude NUMERIC;

-- Tabela associados
ALTER TABLE associados 
ADD COLUMN IF NOT EXISTS endereco_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS endereco_longitude NUMERIC;
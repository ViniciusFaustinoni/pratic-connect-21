-- Adicionar colunas de coordenadas na tabela cotacoes
ALTER TABLE cotacoes 
ADD COLUMN IF NOT EXISTS vistoria_endereco_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS vistoria_endereco_longitude NUMERIC;
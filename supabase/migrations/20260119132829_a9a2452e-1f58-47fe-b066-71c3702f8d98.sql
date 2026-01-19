-- Adicionar colunas de coordenadas na tabela vistorias
ALTER TABLE vistorias 
ADD COLUMN IF NOT EXISTS endereco_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS endereco_longitude NUMERIC;
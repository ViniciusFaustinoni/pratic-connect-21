-- Adicionar campo codigo_sga_voluntario na tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS codigo_sga_voluntario VARCHAR(20);

COMMENT ON COLUMN profiles.codigo_sga_voluntario 
IS 'Código do voluntário no SGA Hinova para sincronização de veículos';
-- 1. Adicionar coluna imei_rastreador na tabela vistorias
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS imei_rastreador VARCHAR(20);

-- 2. Adicionar colunas para email e associado_id na tabela rastreadores
ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS associado_email VARCHAR(255);
ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS associado_id UUID REFERENCES associados(id);

-- 3. Criar índice para busca por IMEI
CREATE INDEX IF NOT EXISTS idx_rastreadores_imei ON rastreadores(imei);

-- 4. Criar índice para busca por associado_id em rastreadores
CREATE INDEX IF NOT EXISTS idx_rastreadores_associado ON rastreadores(associado_id);
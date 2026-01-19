-- Adicionar campo vistoria_rota_id na tabela contratos
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS vistoria_rota_id UUID REFERENCES rotas(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_contratos_vistoria_rota_id ON contratos(vistoria_rota_id);
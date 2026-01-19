-- Adicionar coluna veiculo_id como FK na tabela contratos
ALTER TABLE contratos 
ADD COLUMN IF NOT EXISTS veiculo_id UUID REFERENCES veiculos(id);

-- Migrar dados existentes: vincular veículos pela placa
UPDATE contratos c
SET veiculo_id = v.id
FROM veiculos v
WHERE c.veiculo_placa = v.placa
  AND c.veiculo_id IS NULL;

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_contratos_veiculo_id ON contratos(veiculo_id);
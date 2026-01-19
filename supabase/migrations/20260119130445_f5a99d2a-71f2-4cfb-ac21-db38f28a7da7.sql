-- Adicionar campos faltantes na tabela vistorias
ALTER TABLE vistorias
ADD COLUMN IF NOT EXISTS endereco_bairro TEXT,
ADD COLUMN IF NOT EXISTS endereco_cep TEXT,
ADD COLUMN IF NOT EXISTS endereco_numero TEXT,
ADD COLUMN IF NOT EXISTS rota_id UUID REFERENCES rotas(id) ON DELETE SET NULL;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_vistorias_rota_id ON vistorias(rota_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_endereco_bairro ON vistorias(endereco_bairro);
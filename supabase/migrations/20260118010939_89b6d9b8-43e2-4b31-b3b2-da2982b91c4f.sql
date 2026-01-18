-- Adicionar colunas de assinatura Autentique na tabela vistorias
ALTER TABLE vistorias 
ADD COLUMN IF NOT EXISTS assinatura_autentique_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS assinatura_status VARCHAR(20) DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS assinatura_enviada_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assinatura_concluida_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assinatura_documento_url TEXT;

-- Criar índice para busca por status de assinatura
CREATE INDEX IF NOT EXISTS idx_vistorias_assinatura_status ON vistorias(assinatura_status);

-- Criar índice para busca por ID do Autentique
CREATE INDEX IF NOT EXISTS idx_vistorias_assinatura_autentique_id ON vistorias(assinatura_autentique_id) WHERE assinatura_autentique_id IS NOT NULL;
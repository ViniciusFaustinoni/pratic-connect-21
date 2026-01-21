-- Adicionar campos de anexo na tabela sinistro_mensagens
ALTER TABLE sinistro_mensagens 
ADD COLUMN IF NOT EXISTS anexo_url TEXT,
ADD COLUMN IF NOT EXISTS anexo_nome TEXT,
ADD COLUMN IF NOT EXISTS anexo_tipo VARCHAR(50);

-- Adicionar campo enviado_em na tabela sinistro_documentos (se não existir)
ALTER TABLE sinistro_documentos 
ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMPTZ;

-- Índice para busca por mensagens não lidas (para badge)
CREATE INDEX IF NOT EXISTS idx_sinistro_mensagens_nao_lidas 
ON sinistro_mensagens(sinistro_id, lida) 
WHERE lida = false;

-- Índice para documentos pendentes
CREATE INDEX IF NOT EXISTS idx_sinistro_documentos_pendentes 
ON sinistro_documentos(sinistro_id, status) 
WHERE status = 'pendente';
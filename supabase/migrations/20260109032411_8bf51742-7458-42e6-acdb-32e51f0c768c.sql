-- ═══════════════════════════════════════════════════════════════
-- CORREÇÃO 1.5.2: Adicionar coluna 'ativo' com default TRUE
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true NOT NULL;

-- Comentário para documentação
COMMENT ON COLUMN leads.ativo IS 'Indica se o lead está ativo no sistema. Default: true';
-- =============================================
-- ATUALIZAÇÃO TABELA COTACOES
-- Para suportar sistema de cotação automática
-- =============================================

-- Novas colunas para cotação avançada
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS regiao VARCHAR(10);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS categoria VARCHAR(20);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS combustivel VARCHAR(20);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS uso_aplicativo BOOLEAN DEFAULT false;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS desagio_aplicado DECIMAL(5,2) DEFAULT 0;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS valor_adesao_original DECIMAL(12,2);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS valor_mensal_original DECIMAL(12,2);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS adicionais_selecionados JSONB DEFAULT '{}';
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cidade VARCHAR(100);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS token_publico VARCHAR(64);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS dados_extras JSONB DEFAULT '{}';
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_placa VARCHAR(10);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_combustivel VARCHAR(20);

-- Índices para performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_cotacoes_token_publico ON cotacoes(token_publico) WHERE token_publico IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cotacoes_regiao ON cotacoes(regiao);
CREATE INDEX IF NOT EXISTS idx_cotacoes_categoria ON cotacoes(categoria);
CREATE INDEX IF NOT EXISTS idx_cotacoes_status_created ON cotacoes(status, created_at DESC);

-- RLS policy para acesso público via token
CREATE POLICY "Acesso público via token" 
ON cotacoes 
FOR SELECT 
TO anon
USING (token_publico IS NOT NULL);

-- Comentários para documentação
COMMENT ON COLUMN cotacoes.regiao IS 'RJ, LAGOS ou SP - detectado automaticamente pela cidade';
COMMENT ON COLUMN cotacoes.categoria IS 'BASIC, PREMIUM ou EXCLUSIVE';
COMMENT ON COLUMN cotacoes.combustivel IS 'GASOLINA ou DIESEL';
COMMENT ON COLUMN cotacoes.uso_aplicativo IS 'Se veículo é usado para aplicativos (Uber, 99, etc)';
COMMENT ON COLUMN cotacoes.desagio_aplicado IS 'Percentual de desconto aplicado (0-30)';
COMMENT ON COLUMN cotacoes.adicionais_selecionados IS 'JSON com adicionais: vidros, carroReserva, guinchoIlimitado, rastreamento';
COMMENT ON COLUMN cotacoes.token_publico IS 'Token único de 64 caracteres para link público';
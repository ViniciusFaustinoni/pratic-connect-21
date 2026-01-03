-- =====================================================
-- MÓDULO DE VENDAS - AJUSTES NAS TABELAS
-- =====================================================

-- 1. Adicionar novos valores ao enum etapa_lead
ALTER TYPE etapa_lead ADD VALUE IF NOT EXISTS 'contato';
ALTER TYPE etapa_lead ADD VALUE IF NOT EXISTS 'qualificado';

-- 2. Adicionar coluna codigo_fipe em leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS codigo_fipe VARCHAR(20);

-- 3. Adicionar colunas de snapshot em cotacoes
ALTER TABLE cotacoes 
  ADD COLUMN IF NOT EXISTS veiculo_marca VARCHAR(100),
  ADD COLUMN IF NOT EXISTS veiculo_modelo VARCHAR(100),
  ADD COLUMN IF NOT EXISTS veiculo_ano INTEGER,
  ADD COLUMN IF NOT EXISTS codigo_fipe VARCHAR(20),
  ADD COLUMN IF NOT EXISTS valor_assistencia DECIMAL(10,2) DEFAULT 0;

-- 4. Adicionar colunas em contratos
ALTER TABLE contratos 
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id),
  ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER,
  ADD COLUMN IF NOT EXISTS autentique_documento_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS autentique_url VARCHAR(500);

-- 5. Adicionar constraint de dia_vencimento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_dia_vencimento'
  ) THEN
    ALTER TABLE contratos 
      ADD CONSTRAINT check_dia_vencimento 
      CHECK (dia_vencimento IS NULL OR (dia_vencimento BETWEEN 1 AND 28));
  END IF;
END $$;

-- 6. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_vendedor ON leads(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_leads_etapa ON leads(etapa);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cotacoes_lead ON cotacoes(lead_id);
CREATE INDEX IF NOT EXISTS idx_contratos_lead ON contratos(lead_id);
CREATE INDEX IF NOT EXISTS idx_contratos_cotacao ON contratos(cotacao_id);
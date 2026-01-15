-- ═══════════════════════════════════════════════════════════════════
-- ADICIONAR COLUNAS DE APROVAÇÃO NAS TABELAS EXISTENTES
-- ═══════════════════════════════════════════════════════════════════

-- 1. Colunas de aprovação na tabela CONTRATOS
ALTER TABLE contratos 
ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS analista_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS observacao_aprovacao TEXT;

-- 2. Colunas de aprovação na tabela ASSOCIADOS  
ALTER TABLE associados
ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS data_ativacao TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS primeiro_boleto_gerado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS instalacao_agendada BOOLEAN DEFAULT false;

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_contratos_aprovado_por ON contratos(aprovado_por);
CREATE INDEX IF NOT EXISTS idx_contratos_aprovado_em ON contratos(aprovado_em);
CREATE INDEX IF NOT EXISTS idx_associados_aprovado_por ON associados(aprovado_por);
CREATE INDEX IF NOT EXISTS idx_associados_data_ativacao ON associados(data_ativacao);
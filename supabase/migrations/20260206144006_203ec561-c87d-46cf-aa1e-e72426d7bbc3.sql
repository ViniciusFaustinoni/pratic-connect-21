-- ============================================
-- MIGRATION 1: Campos adicionais para comissionamento
-- ============================================

-- 1. Campos em associados (para rastrear cancelamento e vendedor original)
ALTER TABLE associados 
  ADD COLUMN IF NOT EXISTS vendedor_original_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT,
  ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_primeiro_boleto_pago TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qtd_boletos_pagos INTEGER DEFAULT 0;

-- Comentários
COMMENT ON COLUMN associados.vendedor_original_id IS 'Vendedor que fez a venda original (preservado após troca de titularidade)';
COMMENT ON COLUMN associados.motivo_cancelamento IS 'Motivo do cancelamento do associado';
COMMENT ON COLUMN associados.data_cancelamento IS 'Data efetiva do cancelamento';
COMMENT ON COLUMN associados.data_primeiro_boleto_pago IS 'Data do primeiro boleto pago pelo associado';
COMMENT ON COLUMN associados.qtd_boletos_pagos IS 'Quantidade total de boletos pagos pelo associado';

-- 2. Campos em comissoes (para tipos de comissão e vínculos)
ALTER TABLE comissoes
  ADD COLUMN IF NOT EXISTS tipo_comissao VARCHAR(50) DEFAULT 'adesao',
  ADD COLUMN IF NOT EXISTS cobranca_id UUID,
  ADD COLUMN IF NOT EXISTS campanha_id UUID,
  ADD COLUMN IF NOT EXISTS associado_id UUID REFERENCES associados(id),
  ADD COLUMN IF NOT EXISTS valor_bruto NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_deducoes NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deducoes_detalhes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recalculada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recalculada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recalculada_motivo TEXT,
  ADD COLUMN IF NOT EXISTS contestada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS contestada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contestacao_motivo TEXT,
  ADD COLUMN IF NOT EXISTS contestacao_resposta TEXT;

COMMENT ON COLUMN comissoes.tipo_comissao IS 'Tipo: adesao, recorrente, producao, classificacao, crescimento, recorde';
COMMENT ON COLUMN comissoes.deducoes_detalhes IS 'JSON com detalhamento: [{tipo: "repasse_volante", valor: 50}, {tipo: "taxa_cartao", valor: 12.50}]';

-- 3. Campos em contratos (para rastrear tipo de atendimento)
ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS tipo_atendimento VARCHAR(20) DEFAULT 'volante',
  ADD COLUMN IF NOT EXISTS tipo_venda VARCHAR(20) DEFAULT 'nova',
  ADD COLUMN IF NOT EXISTS origem_troca_titularidade_id UUID;

COMMENT ON COLUMN contratos.tipo_atendimento IS 'volante ou base_administrativa - afeta repasse de R$50';
COMMENT ON COLUMN contratos.tipo_venda IS 'nova, troca_titularidade, substituicao_placa, migracao, reativacao';
COMMENT ON COLUMN contratos.origem_troca_titularidade_id IS 'Contrato original quando é troca de titularidade';

-- 4. Campos em funcionarios (para tempo de casa no ranking)
ALTER TABLE funcionarios
  ADD COLUMN IF NOT EXISTS recorde_vendas_mensal INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mes_recorde INTEGER,
  ADD COLUMN IF NOT EXISTS ano_recorde INTEGER;

COMMENT ON COLUMN funcionarios.recorde_vendas_mensal IS 'Maior quantidade de vendas confirmadas em um único mês';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_comissoes_tipo ON comissoes(tipo_comissao);
CREATE INDEX IF NOT EXISTS idx_comissoes_campanha ON comissoes(campanha_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_vendedor_mes ON comissoes(vendedor_id, mes_referencia, ano_referencia);
CREATE INDEX IF NOT EXISTS idx_associados_vendedor_original ON associados(vendedor_original_id);
CREATE INDEX IF NOT EXISTS idx_contratos_tipo_venda ON contratos(tipo_venda);
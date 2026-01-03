-- =====================================================
-- MÓDULO 5 - PROMPT 01
-- INTEGRAÇÃO ASAAS - ESTRUTURA DE DADOS (CORRIGIDA)
-- =====================================================

-- =====================================================
-- 1. TABELA: asaas_clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS asaas_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  asaas_id VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(255),
  cpf_cnpj VARCHAR(20),
  email VARCHAR(255),
  telefone VARCHAR(20),
  cep VARCHAR(10),
  logradouro VARCHAR(255),
  numero VARCHAR(20),
  complemento VARCHAR(100),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  uf VARCHAR(2),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sincronizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asaas_clientes_associado ON asaas_clientes(associado_id);
CREATE INDEX IF NOT EXISTS idx_asaas_clientes_asaas_id ON asaas_clientes(asaas_id);
CREATE INDEX IF NOT EXISTS idx_asaas_clientes_cpf ON asaas_clientes(cpf_cnpj);

COMMENT ON TABLE asaas_clientes IS 'Vínculo entre associados do sistema e clientes cadastrados no ASAAS';

-- =====================================================
-- 2. TABELA: asaas_cobrancas
-- =====================================================
CREATE TABLE IF NOT EXISTS asaas_cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  asaas_cliente_id UUID REFERENCES asaas_clientes(id) ON DELETE SET NULL,
  asaas_id VARCHAR(50) NOT NULL UNIQUE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('mensalidade', 'adesao', 'servico', 'multa', 'outro')),
  referencia VARCHAR(100),
  competencia VARCHAR(7),
  valor DECIMAL(10, 2) NOT NULL,
  valor_liquido DECIMAL(10, 2),
  desconto DECIMAL(10, 2) DEFAULT 0,
  juros DECIMAL(10, 2) DEFAULT 0,
  multa DECIMAL(10, 2) DEFAULT 0,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(30) NOT NULL CHECK (status IN (
    'PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE', 'REFUNDED',
    'RECEIVED_IN_CASH', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS',
    'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL',
    'DUNNING_REQUESTED', 'DUNNING_RECEIVED', 'AWAITING_RISK_ANALYSIS'
  )),
  forma_pagamento VARCHAR(20) CHECK (forma_pagamento IN (
    'BOLETO', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'DEPOSIT', 'UNDEFINED'
  )),
  boleto_url TEXT,
  boleto_codigo_barras VARCHAR(60),
  boleto_nosso_numero VARCHAR(30),
  pix_qrcode TEXT,
  pix_copia_cola TEXT,
  pix_expiracao TIMESTAMPTZ,
  pagamento_data TIMESTAMPTZ,
  pagamento_valor DECIMAL(10, 2),
  pagamento_forma VARCHAR(20),
  pagamento_transacao_id VARCHAR(100),
  notificacao_enviada BOOLEAN DEFAULT false,
  notificacao_data TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sincronizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_associado ON asaas_cobrancas(associado_id);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_asaas_id ON asaas_cobrancas(asaas_id);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_status ON asaas_cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_vencimento ON asaas_cobrancas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_competencia ON asaas_cobrancas(competencia);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_pendentes ON asaas_cobrancas(associado_id, data_vencimento) WHERE status IN ('PENDING', 'OVERDUE');

COMMENT ON TABLE asaas_cobrancas IS 'Cobranças (boletos, Pix) geradas no ASAAS';

-- =====================================================
-- 3. TABELA: asaas_pagamentos
-- =====================================================
CREATE TABLE IF NOT EXISTS asaas_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id UUID REFERENCES asaas_cobrancas(id) ON DELETE SET NULL,
  associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  asaas_id VARCHAR(50) NOT NULL UNIQUE,
  asaas_cobranca_id VARCHAR(50),
  valor DECIMAL(10, 2) NOT NULL,
  valor_liquido DECIMAL(10, 2),
  taxa DECIMAL(10, 2) DEFAULT 0,
  forma_pagamento VARCHAR(20) NOT NULL,
  data_pagamento TIMESTAMPTZ NOT NULL,
  data_credito TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL,
  transacao_id VARCHAR(100),
  comprovante_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asaas_pagamentos_associado ON asaas_pagamentos(associado_id);
CREATE INDEX IF NOT EXISTS idx_asaas_pagamentos_cobranca ON asaas_pagamentos(cobranca_id);
CREATE INDEX IF NOT EXISTS idx_asaas_pagamentos_data ON asaas_pagamentos(data_pagamento DESC);

COMMENT ON TABLE asaas_pagamentos IS 'Histórico de pagamentos recebidos via ASAAS';

-- =====================================================
-- 4. TABELA: asaas_webhooks_log
-- =====================================================
CREATE TABLE IF NOT EXISTS asaas_webhooks_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  processado BOOLEAN DEFAULT false,
  processado_em TIMESTAMPTZ,
  erro TEXT,
  asaas_cobranca_id VARCHAR(50),
  asaas_pagamento_id VARCHAR(50),
  asaas_cliente_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_evento ON asaas_webhooks_log(evento);
CREATE INDEX IF NOT EXISTS idx_webhooks_processado ON asaas_webhooks_log(processado);
CREATE INDEX IF NOT EXISTS idx_webhooks_data ON asaas_webhooks_log(created_at DESC);

COMMENT ON TABLE asaas_webhooks_log IS 'Log de webhooks recebidos do ASAAS para auditoria';

-- =====================================================
-- 5. TABELA: asaas_config
-- =====================================================
CREATE TABLE IF NOT EXISTS asaas_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave VARCHAR(50) NOT NULL UNIQUE,
  valor TEXT,
  descricao TEXT,
  tipo VARCHAR(20) DEFAULT 'string' CHECK (tipo IN ('string', 'number', 'boolean', 'json')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO asaas_config (chave, valor, descricao, tipo) VALUES
  ('ambiente', 'sandbox', 'Ambiente: sandbox ou producao', 'string'),
  ('webhook_secret', '', 'Secret para validar webhooks', 'string'),
  ('dias_vencimento_padrao', '5', 'Dias após emissão para vencimento', 'number'),
  ('multa_percentual', '2', 'Percentual de multa por atraso', 'number'),
  ('juros_percentual', '1', 'Percentual de juros ao mês', 'number'),
  ('desconto_antecipacao_percentual', '0', 'Desconto para pagamento antecipado', 'number'),
  ('notificar_vencimento_dias', '3', 'Dias antes do vencimento para notificar', 'number'),
  ('notificar_atraso_dias', '1,3,7,15,30', 'Dias após vencimento para notificar', 'string')
ON CONFLICT (chave) DO NOTHING;

COMMENT ON TABLE asaas_config IS 'Configurações da integração com ASAAS';

-- =====================================================
-- 6. RLS (Row Level Security) - USANDO FUNÇÕES EXISTENTES
-- =====================================================

-- asaas_clientes
ALTER TABLE asaas_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage ASAAS clients" ON asaas_clientes
  FOR ALL TO authenticated
  USING (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own ASAAS client" ON asaas_clientes
  FOR SELECT TO authenticated
  USING (associado_id = get_my_associado_id(auth.uid()));

-- asaas_cobrancas
ALTER TABLE asaas_cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage ASAAS charges" ON asaas_cobrancas
  FOR ALL TO authenticated
  USING (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own charges" ON asaas_cobrancas
  FOR SELECT TO authenticated
  USING (associado_id = get_my_associado_id(auth.uid()));

-- asaas_pagamentos
ALTER TABLE asaas_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view ASAAS payments" ON asaas_pagamentos
  FOR SELECT TO authenticated
  USING (is_funcionario(auth.uid()));

CREATE POLICY "Staff can insert ASAAS payments" ON asaas_pagamentos
  FOR INSERT TO authenticated
  WITH CHECK (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own payments" ON asaas_pagamentos
  FOR SELECT TO authenticated
  USING (associado_id = get_my_associado_id(auth.uid()));

-- asaas_webhooks_log
ALTER TABLE asaas_webhooks_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert webhooks" ON asaas_webhooks_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view webhooks" ON asaas_webhooks_log
  FOR SELECT TO authenticated
  USING (is_funcionario(auth.uid()));

CREATE POLICY "Staff can update webhooks" ON asaas_webhooks_log
  FOR UPDATE TO authenticated
  USING (is_funcionario(auth.uid()));

-- asaas_config
ALTER TABLE asaas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage ASAAS config" ON asaas_config
  FOR ALL TO authenticated
  USING (is_funcionario(auth.uid()));

-- =====================================================
-- 7. TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE TRIGGER trigger_asaas_clientes_updated
  BEFORE UPDATE ON asaas_clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_asaas_cobrancas_updated
  BEFORE UPDATE ON asaas_cobrancas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_asaas_config_updated
  BEFORE UPDATE ON asaas_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. VIEW: Resumo financeiro do associado
-- =====================================================

CREATE OR REPLACE VIEW view_associado_financeiro AS
SELECT 
  a.id AS associado_id,
  a.nome,
  a.cpf,
  a.status AS associado_status,
  COUNT(c.id) AS total_cobrancas,
  COUNT(c.id) FILTER (WHERE c.status = 'PENDING') AS cobrancas_pendentes,
  COUNT(c.id) FILTER (WHERE c.status = 'OVERDUE') AS cobrancas_vencidas,
  COUNT(c.id) FILTER (WHERE c.status IN ('RECEIVED', 'CONFIRMED')) AS cobrancas_pagas,
  COALESCE(SUM(c.valor) FILTER (WHERE c.status = 'PENDING'), 0) AS valor_pendente,
  COALESCE(SUM(c.valor) FILTER (WHERE c.status = 'OVERDUE'), 0) AS valor_vencido,
  COALESCE(SUM(c.valor) FILTER (WHERE c.status IN ('RECEIVED', 'CONFIRMED')), 0) AS valor_pago,
  MIN(c.data_vencimento) FILTER (WHERE c.status = 'PENDING') AS proximo_vencimento,
  MAX(CURRENT_DATE - c.data_vencimento) FILTER (WHERE c.status = 'OVERDUE') AS dias_maior_atraso
FROM associados a
LEFT JOIN asaas_cobrancas c ON c.associado_id = a.id
GROUP BY a.id, a.nome, a.cpf, a.status;

COMMENT ON VIEW view_associado_financeiro IS 'Resumo financeiro dos associados com totais de cobranças';
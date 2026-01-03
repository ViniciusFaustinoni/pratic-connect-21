-- =============================================
-- MÓDULO CONTABILIDADE - TABELAS
-- =============================================

-- Sequence para número do lançamento
CREATE SEQUENCE IF NOT EXISTS lancamento_seq START 1;

-- PLANO DE CONTAS
CREATE TABLE IF NOT EXISTS plano_contas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    
    -- Hierarquia
    conta_pai_id UUID REFERENCES plano_contas(id),
    nivel INTEGER NOT NULL CHECK (nivel BETWEEN 1 AND 5),
    
    -- Classificação
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN (
        'ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa'
    )),
    natureza VARCHAR(10) NOT NULL CHECK (natureza IN ('devedora', 'credora')),
    
    -- Tipo de conta
    sintetica BOOLEAN DEFAULT false,
    aceita_lancamento BOOLEAN DEFAULT true,
    
    -- Configuração
    ativa BOOLEAN DEFAULT true,
    ordem INTEGER DEFAULT 0,
    
    -- Integração automática
    conta_padrao_para VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LANÇAMENTOS CONTÁBEIS
CREATE TABLE IF NOT EXISTS lancamentos_contabeis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero VARCHAR(20) UNIQUE,
    
    -- Data
    data_lancamento DATE NOT NULL,
    data_competencia DATE NOT NULL,
    
    -- Lote/Partida
    lote_id UUID,
    
    -- Origem
    origem VARCHAR(30) NOT NULL CHECK (origem IN (
        'manual', 'cobranca', 'pagamento', 'acordo', 
        'sinistro', 'oficina', 'folha', 'fechamento'
    )),
    origem_id UUID,
    
    -- Descrição
    historico VARCHAR(500) NOT NULL,
    complemento TEXT,
    
    -- Documento
    documento_tipo VARCHAR(30),
    documento_numero VARCHAR(50),
    
    -- Status
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN (
        'rascunho', 'ativo', 'estornado', 'fechado'
    )),
    
    -- Controle
    criado_por UUID REFERENCES profiles(id),
    estornado_por UUID REFERENCES profiles(id),
    estornado_em TIMESTAMPTZ,
    motivo_estorno TEXT,
    lancamento_estorno_id UUID REFERENCES lancamentos_contabeis(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PARTIDAS DO LANÇAMENTO (Débito/Crédito)
CREATE TABLE IF NOT EXISTS lancamentos_partidas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lancamento_id UUID NOT NULL REFERENCES lancamentos_contabeis(id) ON DELETE CASCADE,
    
    -- Conta
    conta_id UUID NOT NULL REFERENCES plano_contas(id),
    
    -- Valores
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('debito', 'credito')),
    valor DECIMAL(14,2) NOT NULL CHECK (valor > 0),
    
    -- Ordem
    ordem INTEGER DEFAULT 1,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FECHAMENTOS MENSAIS
CREATE TABLE IF NOT EXISTS fechamentos_contabeis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Período
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano INTEGER NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'aberto' CHECK (status IN (
        'aberto', 'em_fechamento', 'fechado', 'reaberto'
    )),
    
    -- Totais
    total_debitos DECIMAL(14,2) DEFAULT 0,
    total_creditos DECIMAL(14,2) DEFAULT 0,
    qtd_lancamentos INTEGER DEFAULT 0,
    
    -- Resultado
    resultado_periodo DECIMAL(14,2),
    
    -- Datas
    data_fechamento TIMESTAMPTZ,
    data_reabertura TIMESTAMPTZ,
    
    -- Controle
    fechado_por UUID REFERENCES profiles(id),
    reaberto_por UUID REFERENCES profiles(id),
    motivo_reabertura TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(mes, ano)
);

-- SALDOS DAS CONTAS (Cache para performance)
CREATE TABLE IF NOT EXISTS saldos_contas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_id UUID NOT NULL REFERENCES plano_contas(id),
    
    -- Período
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano INTEGER NOT NULL,
    
    -- Saldos
    saldo_anterior DECIMAL(14,2) DEFAULT 0,
    total_debitos DECIMAL(14,2) DEFAULT 0,
    total_creditos DECIMAL(14,2) DEFAULT 0,
    saldo_atual DECIMAL(14,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(conta_id, mes, ano)
);

-- CENTROS DE CUSTO
CREATE TABLE IF NOT EXISTS centros_custo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    centro_pai_id UUID REFERENCES centros_custo(id),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_plano_contas_codigo ON plano_contas(codigo);
CREATE INDEX IF NOT EXISTS idx_plano_contas_tipo ON plano_contas(tipo);
CREATE INDEX IF NOT EXISTS idx_plano_contas_pai ON plano_contas(conta_pai_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos_contabeis(data_competencia);
CREATE INDEX IF NOT EXISTS idx_lancamentos_origem ON lancamentos_contabeis(origem, origem_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON lancamentos_contabeis(status);
CREATE INDEX IF NOT EXISTS idx_partidas_lancamento ON lancamentos_partidas(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_partidas_conta ON lancamentos_partidas(conta_id);
CREATE INDEX IF NOT EXISTS idx_saldos_periodo ON saldos_contas(ano, mes);

-- FUNÇÃO PARA GERAR NÚMERO DO LANÇAMENTO
CREATE OR REPLACE FUNCTION gerar_numero_lancamento()
RETURNS TRIGGER AS $$
DECLARE
  seq INTEGER;
  periodo VARCHAR(6);
BEGIN
  periodo := TO_CHAR(NEW.data_competencia, 'YYYYMM');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 12 FOR 5) AS INTEGER)), 0) + 1
  INTO seq
  FROM lancamentos_contabeis
  WHERE numero LIKE 'LCT-' || periodo || '-%';
  
  NEW.numero := 'LCT-' || periodo || '-' || LPAD(seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_gerar_numero_lancamento
  BEFORE INSERT ON lancamentos_contabeis
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION gerar_numero_lancamento();

-- RLS POLICIES

-- Plano de Contas
ALTER TABLE plano_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plano_contas_select_funcionario" ON plano_contas
  FOR SELECT USING (is_funcionario(auth.uid()));

CREATE POLICY "plano_contas_all_gerencia" ON plano_contas
  FOR ALL USING (is_gerencia(auth.uid()));

-- Lançamentos Contábeis
ALTER TABLE lancamentos_contabeis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lancamentos_select_funcionario" ON lancamentos_contabeis
  FOR SELECT USING (is_funcionario(auth.uid()));

CREATE POLICY "lancamentos_insert_gerencia" ON lancamentos_contabeis
  FOR INSERT WITH CHECK (is_gerencia(auth.uid()));

CREATE POLICY "lancamentos_update_gerencia" ON lancamentos_contabeis
  FOR UPDATE USING (is_gerencia(auth.uid()));

-- Partidas
ALTER TABLE lancamentos_partidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partidas_select_funcionario" ON lancamentos_partidas
  FOR SELECT USING (is_funcionario(auth.uid()));

CREATE POLICY "partidas_all_gerencia" ON lancamentos_partidas
  FOR ALL USING (is_gerencia(auth.uid()));

-- Fechamentos
ALTER TABLE fechamentos_contabeis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fechamentos_select_funcionario" ON fechamentos_contabeis
  FOR SELECT USING (is_funcionario(auth.uid()));

CREATE POLICY "fechamentos_all_gerencia" ON fechamentos_contabeis
  FOR ALL USING (is_gerencia(auth.uid()));

-- Saldos
ALTER TABLE saldos_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saldos_select_funcionario" ON saldos_contas
  FOR SELECT USING (is_funcionario(auth.uid()));

CREATE POLICY "saldos_all_gerencia" ON saldos_contas
  FOR ALL USING (is_gerencia(auth.uid()));

-- Centros de Custo
ALTER TABLE centros_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "centros_custo_select_funcionario" ON centros_custo
  FOR SELECT USING (is_funcionario(auth.uid()));

CREATE POLICY "centros_custo_all_gerencia" ON centros_custo
  FOR ALL USING (is_gerencia(auth.uid()));

-- PLANO DE CONTAS PADRÃO
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, nivel, sintetica, aceita_lancamento) VALUES
-- ATIVO
('1', 'ATIVO', 'ativo', 'devedora', 1, true, false),
('1.1', 'ATIVO CIRCULANTE', 'ativo', 'devedora', 2, true, false),
('1.1.01', 'Caixa e Equivalentes', 'ativo', 'devedora', 3, true, false),
('1.1.01.001', 'Caixa Geral', 'ativo', 'devedora', 4, false, true),
('1.1.01.002', 'Banco Conta Movimento', 'ativo', 'devedora', 4, false, true),
('1.1.02', 'Contas a Receber', 'ativo', 'devedora', 3, true, false),
('1.1.02.001', 'Mensalidades a Receber', 'ativo', 'devedora', 4, false, true),
('1.1.02.002', 'Acordos a Receber', 'ativo', 'devedora', 4, false, true),
-- PASSIVO
('2', 'PASSIVO', 'passivo', 'credora', 1, true, false),
('2.1', 'PASSIVO CIRCULANTE', 'passivo', 'credora', 2, true, false),
('2.1.01', 'Fornecedores', 'passivo', 'credora', 3, true, false),
('2.1.01.001', 'Oficinas a Pagar', 'passivo', 'credora', 4, false, true),
('2.1.01.002', 'Prestadores a Pagar', 'passivo', 'credora', 4, false, true),
('2.1.02', 'Obrigações Trabalhistas', 'passivo', 'credora', 3, true, false),
('2.1.02.001', 'Salários a Pagar', 'passivo', 'credora', 4, false, true),
('2.1.03', 'Obrigações Tributárias', 'passivo', 'credora', 3, true, false),
('2.1.03.001', 'Impostos a Pagar', 'passivo', 'credora', 4, false, true),
-- PATRIMÔNIO LÍQUIDO
('3', 'PATRIMÔNIO LÍQUIDO', 'patrimonio_liquido', 'credora', 1, true, false),
('3.1', 'Capital Social', 'patrimonio_liquido', 'credora', 2, false, true),
('3.2', 'Reservas', 'patrimonio_liquido', 'credora', 2, true, false),
('3.2.01', 'Reserva de Contingência', 'patrimonio_liquido', 'credora', 3, false, true),
('3.3', 'Resultado Acumulado', 'patrimonio_liquido', 'credora', 2, false, true),
-- RECEITAS
('4', 'RECEITAS', 'receita', 'credora', 1, true, false),
('4.1', 'RECEITAS OPERACIONAIS', 'receita', 'credora', 2, true, false),
('4.1.01', 'Receitas de Mensalidades', 'receita', 'credora', 3, true, false),
('4.1.01.001', 'Mensalidades Recebidas', 'receita', 'credora', 4, false, true),
('4.1.02', 'Receitas de Adesão', 'receita', 'credora', 3, true, false),
('4.1.02.001', 'Taxas de Adesão', 'receita', 'credora', 4, false, true),
('4.1.03', 'Outras Receitas', 'receita', 'credora', 3, true, false),
('4.1.03.001', 'Multas e Juros Recebidos', 'receita', 'credora', 4, false, true),
-- DESPESAS
('5', 'DESPESAS', 'despesa', 'devedora', 1, true, false),
('5.1', 'DESPESAS OPERACIONAIS', 'despesa', 'devedora', 2, true, false),
('5.1.01', 'Despesas com Sinistros', 'despesa', 'devedora', 3, true, false),
('5.1.01.001', 'Indenizações Pagas', 'despesa', 'devedora', 4, false, true),
('5.1.01.002', 'Reparos em Oficinas', 'despesa', 'devedora', 4, false, true),
('5.1.02', 'Despesas com Assistência', 'despesa', 'devedora', 3, true, false),
('5.1.02.001', 'Guincho e Reboque', 'despesa', 'devedora', 4, false, true),
('5.1.02.002', 'Chaveiro', 'despesa', 'devedora', 4, false, true),
('5.1.03', 'Despesas com Pessoal', 'despesa', 'devedora', 3, true, false),
('5.1.03.001', 'Salários e Ordenados', 'despesa', 'devedora', 4, false, true),
('5.1.03.002', 'Encargos Sociais', 'despesa', 'devedora', 4, false, true),
('5.1.04', 'Despesas Administrativas', 'despesa', 'devedora', 3, true, false),
('5.1.04.001', 'Aluguel', 'despesa', 'devedora', 4, false, true),
('5.1.04.002', 'Energia Elétrica', 'despesa', 'devedora', 4, false, true),
('5.1.04.003', 'Telefone e Internet', 'despesa', 'devedora', 4, false, true),
('5.1.04.004', 'Material de Escritório', 'despesa', 'devedora', 4, false, true),
('5.1.05', 'Despesas Financeiras', 'despesa', 'devedora', 3, true, false),
('5.1.05.001', 'Tarifas Bancárias', 'despesa', 'devedora', 4, false, true),
('5.1.05.002', 'Juros Pagos', 'despesa', 'devedora', 4, false, true)
ON CONFLICT (codigo) DO NOTHING;

-- Atualizar conta_pai_id baseado no código
UPDATE plano_contas p
SET conta_pai_id = (
  SELECT id FROM plano_contas pai 
  WHERE pai.codigo = LEFT(p.codigo, LENGTH(p.codigo) - LENGTH(SPLIT_PART(REVERSE(p.codigo), '.', 1)) - 1)
)
WHERE p.codigo LIKE '%.%' AND p.conta_pai_id IS NULL;
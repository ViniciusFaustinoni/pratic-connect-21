
-- =============================================
-- MÓDULO 10 - COBRANÇA
-- =============================================

-- RÉGUAS DE COBRANÇA (Configuração de fluxo automatizado)
CREATE TABLE IF NOT EXISTS reguas_cobranca (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    ativa BOOLEAN DEFAULT true,
    etapas JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EXECUÇÕES DA RÉGUA (Log de cada ação executada)
CREATE TABLE IF NOT EXISTS regua_execucoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regua_id UUID NOT NULL REFERENCES reguas_cobranca(id),
    cobranca_id UUID NOT NULL REFERENCES cobrancas(id),
    associado_id UUID NOT NULL REFERENCES associados(id),
    
    etapa_dias INTEGER NOT NULL,
    acao VARCHAR(50) NOT NULL,
    template VARCHAR(100),
    
    status VARCHAR(20) DEFAULT 'pendente',
    resultado TEXT,
    erro TEXT,
    executado_em TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONTATOS DE COBRANÇA (Histórico de tentativas)
CREATE TABLE IF NOT EXISTS cobranca_contatos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID NOT NULL REFERENCES associados(id),
    cobranca_id UUID REFERENCES cobrancas(id),
    
    tipo VARCHAR(30) NOT NULL,
    resultado VARCHAR(30) NOT NULL,
    
    observacao TEXT,
    promessa_data DATE,
    promessa_valor DECIMAL(10,2),
    
    atendente_id UUID REFERENCES auth.users(id),
    duracao_segundos INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ACORDOS DE COBRANÇA
CREATE TABLE IF NOT EXISTS acordos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID NOT NULL REFERENCES associados(id),
    numero VARCHAR(30) UNIQUE,
    
    cobrancas_ids UUID[] NOT NULL,
    
    valor_original DECIMAL(12,2) NOT NULL,
    valor_desconto DECIMAL(12,2) DEFAULT 0,
    valor_juros DECIMAL(12,2) DEFAULT 0,
    valor_acordo DECIMAL(12,2) NOT NULL,
    
    qtd_parcelas INTEGER NOT NULL DEFAULT 1,
    valor_parcela DECIMAL(10,2) NOT NULL,
    dia_vencimento INTEGER NOT NULL,
    primeira_parcela_data DATE NOT NULL,
    
    valor_entrada DECIMAL(10,2) DEFAULT 0,
    entrada_paga BOOLEAN DEFAULT false,
    entrada_data_pagamento DATE,
    
    status VARCHAR(20) DEFAULT 'ativo',
    
    criado_por UUID REFERENCES auth.users(id),
    aprovado_por UUID REFERENCES auth.users(id),
    aprovado_em TIMESTAMPTZ,
    motivo_quebra TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PARCELAS DO ACORDO
CREATE TABLE IF NOT EXISTS acordo_parcelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    acordo_id UUID NOT NULL REFERENCES acordos(id) ON DELETE CASCADE,
    numero_parcela INTEGER NOT NULL,
    
    valor DECIMAL(10,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    valor_pago DECIMAL(10,2),
    
    cobranca_id UUID REFERENCES cobrancas(id),
    
    status VARCHAR(20) DEFAULT 'pendente',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(acordo_id, numero_parcela)
);

-- NEGATIVAÇÃO (SPC/Serasa)
CREATE TABLE IF NOT EXISTS negativacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID NOT NULL REFERENCES associados(id),
    cobranca_id UUID REFERENCES cobrancas(id),
    acordo_id UUID REFERENCES acordos(id),
    
    orgao VARCHAR(30) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    data_divida DATE NOT NULL,
    
    status VARCHAR(20) DEFAULT 'pendente',
    
    data_envio TIMESTAMPTZ,
    data_negativacao TIMESTAMPTZ,
    data_baixa TIMESTAMPTZ,
    
    protocolo_envio VARCHAR(100),
    protocolo_baixa VARCHAR(100),
    
    enviado_por UUID REFERENCES auth.users(id),
    baixado_por UUID REFERENCES auth.users(id),
    motivo_baixa TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FILA DE TRABALHO DE COBRANÇA
CREATE TABLE IF NOT EXISTS cobranca_fila (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID NOT NULL REFERENCES associados(id),
    cobranca_id UUID REFERENCES cobrancas(id),
    
    prioridade INTEGER DEFAULT 5,
    motivo VARCHAR(50) NOT NULL,
    
    data_agendamento TIMESTAMPTZ,
    atribuido_para UUID REFERENCES auth.users(id),
    
    status VARCHAR(20) DEFAULT 'pendente',
    resultado TEXT,
    concluido_em TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE reguas_cobranca ENABLE ROW LEVEL SECURITY;
ALTER TABLE regua_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobranca_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acordos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acordo_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE negativacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobranca_fila ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Réguas de cobrança (somente funcionários)
CREATE POLICY "reguas_cobranca_staff_all" ON reguas_cobranca FOR ALL
  USING (is_funcionario(auth.uid()));

-- Execuções da régua (somente funcionários)
CREATE POLICY "regua_execucoes_staff_all" ON regua_execucoes FOR ALL
  USING (is_funcionario(auth.uid()));

-- Contatos de cobrança
CREATE POLICY "cobranca_contatos_staff_all" ON cobranca_contatos FOR ALL
  USING (is_funcionario(auth.uid()));

CREATE POLICY "cobranca_contatos_associado_select" ON cobranca_contatos FOR SELECT
  USING (associado_id = get_my_associado_id(auth.uid()));

-- Acordos
CREATE POLICY "acordos_staff_all" ON acordos FOR ALL
  USING (is_funcionario(auth.uid()));

CREATE POLICY "acordos_associado_select" ON acordos FOR SELECT
  USING (associado_id = get_my_associado_id(auth.uid()));

-- Parcelas do acordo
CREATE POLICY "acordo_parcelas_staff_all" ON acordo_parcelas FOR ALL
  USING (is_funcionario(auth.uid()));

CREATE POLICY "acordo_parcelas_associado_select" ON acordo_parcelas FOR SELECT
  USING (acordo_id IN (SELECT id FROM acordos WHERE associado_id = get_my_associado_id(auth.uid())));

-- Negativações
CREATE POLICY "negativacoes_staff_all" ON negativacoes FOR ALL
  USING (is_funcionario(auth.uid()));

CREATE POLICY "negativacoes_associado_select" ON negativacoes FOR SELECT
  USING (associado_id = get_my_associado_id(auth.uid()));

-- Fila de cobrança (somente funcionários)
CREATE POLICY "cobranca_fila_staff_all" ON cobranca_fila FOR ALL
  USING (is_funcionario(auth.uid()));

-- =============================================
-- SEQUENCES
-- =============================================
CREATE SEQUENCE IF NOT EXISTS acordo_seq START 1;

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Função para gerar número do acordo
CREATE OR REPLACE FUNCTION gerar_numero_acordo()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero := 'ACO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(nextval('acordo_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_gerar_numero_acordo
  BEFORE INSERT ON acordos
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION gerar_numero_acordo();

-- Triggers de updated_at
CREATE TRIGGER update_reguas_cobranca_updated_at
  BEFORE UPDATE ON reguas_cobranca
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_acordos_updated_at
  BEFORE UPDATE ON acordos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_negativacoes_updated_at
  BEFORE UPDATE ON negativacoes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cobranca_fila_updated_at
  BEFORE UPDATE ON cobranca_fila
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_regua_execucoes_cobranca ON regua_execucoes(cobranca_id);
CREATE INDEX IF NOT EXISTS idx_regua_execucoes_status ON regua_execucoes(status);
CREATE INDEX IF NOT EXISTS idx_cobranca_contatos_associado ON cobranca_contatos(associado_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_contatos_data ON cobranca_contatos(created_at);
CREATE INDEX IF NOT EXISTS idx_acordos_associado ON acordos(associado_id);
CREATE INDEX IF NOT EXISTS idx_acordos_status ON acordos(status);
CREATE INDEX IF NOT EXISTS idx_acordo_parcelas_acordo ON acordo_parcelas(acordo_id);
CREATE INDEX IF NOT EXISTS idx_acordo_parcelas_status ON acordo_parcelas(status);
CREATE INDEX IF NOT EXISTS idx_negativacoes_associado ON negativacoes(associado_id);
CREATE INDEX IF NOT EXISTS idx_negativacoes_status ON negativacoes(status);
CREATE INDEX IF NOT EXISTS idx_cobranca_fila_status ON cobranca_fila(status, prioridade);
CREATE INDEX IF NOT EXISTS idx_cobranca_fila_atribuido ON cobranca_fila(atribuido_para, status);

-- =============================================
-- VIEW INADIMPLENTES
-- =============================================
CREATE OR REPLACE VIEW view_inadimplentes AS
SELECT 
    a.id as associado_id,
    a.nome,
    a.cpf,
    a.telefone,
    a.whatsapp,
    a.email,
    a.status as status_associado,
    COUNT(c.id) as qtd_boletos_vencidos,
    SUM(c.valor_final) as valor_total_divida,
    MIN(c.data_vencimento) as vencimento_mais_antigo,
    MAX(c.data_vencimento) as vencimento_mais_recente,
    CURRENT_DATE - MIN(c.data_vencimento) as dias_atraso_maximo,
    CASE 
        WHEN CURRENT_DATE - MIN(c.data_vencimento) <= 30 THEN 'leve'
        WHEN CURRENT_DATE - MIN(c.data_vencimento) <= 60 THEN 'moderado'
        WHEN CURRENT_DATE - MIN(c.data_vencimento) <= 90 THEN 'grave'
        ELSE 'critico'
    END as faixa_atraso,
    (
        SELECT COUNT(*) FROM cobranca_contatos cc 
        WHERE cc.associado_id = a.id 
        AND cc.created_at > CURRENT_DATE - INTERVAL '30 days'
    ) as contatos_ultimos_30_dias,
    (
        SELECT MAX(created_at) FROM cobranca_contatos cc 
        WHERE cc.associado_id = a.id
    ) as ultimo_contato
FROM associados a
INNER JOIN cobrancas c ON c.associado_id = a.id
WHERE c.status = 'vencido'
AND c.data_vencimento < CURRENT_DATE
GROUP BY a.id, a.nome, a.cpf, a.telefone, a.whatsapp, a.email, a.status;

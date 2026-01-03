-- =============================================
-- MÓDULO FINANCEIRO - TABELAS COMPLEMENTARES
-- =============================================

-- Adicionar colunas faltantes em asaas_cobrancas
ALTER TABLE asaas_cobrancas 
ADD COLUMN IF NOT EXISTS veiculo_id UUID REFERENCES veiculos(id),
ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES contratos(id),
ADD COLUMN IF NOT EXISTS linha_digitavel VARCHAR(60),
ADD COLUMN IF NOT EXISTS lembrete_vencimento_enviado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS cancelado_por UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

-- FATURAMENTOS (Geração em lote)
CREATE TABLE IF NOT EXISTS faturamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referencia_mes INTEGER NOT NULL CHECK (referencia_mes BETWEEN 1 AND 12),
    referencia_ano INTEGER NOT NULL,
    
    total_associados INTEGER DEFAULT 0,
    total_cobrancas INTEGER DEFAULT 0,
    valor_total DECIMAL(12,2) DEFAULT 0,
    valor_pago DECIMAL(12,2) DEFAULT 0,
    valor_pendente DECIMAL(12,2) DEFAULT 0,
    
    status VARCHAR(20) DEFAULT 'rascunho' CHECK (status IN (
        'rascunho', 'processando', 'gerado', 'enviado', 'fechado', 'cancelado'
    )),
    
    data_vencimento DATE,
    data_geracao TIMESTAMPTZ,
    data_envio TIMESTAMPTZ,
    data_fechamento TIMESTAMPTZ,
    
    gerado_por UUID REFERENCES profiles(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(referencia_mes, referencia_ano)
);

-- CONTAS A PAGAR
CREATE TABLE IF NOT EXISTS contas_pagar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    fornecedor_nome VARCHAR(255) NOT NULL,
    fornecedor_documento VARCHAR(18),
    
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN (
        'prestador_assistencia', 'oficina', 'fornecedor',
        'folha_pagamento', 'impostos', 'aluguel', 
        'servicos', 'marketing', 'outros'
    )),
    subcategoria VARCHAR(100),
    
    referencia_id UUID,
    referencia_tipo VARCHAR(50),
    
    valor DECIMAL(12,2) NOT NULL,
    valor_pago DECIMAL(12,2) DEFAULT 0,
    
    data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    
    forma_pagamento VARCHAR(30),
    banco VARCHAR(100),
    agencia VARCHAR(20),
    conta VARCHAR(30),
    pix_chave VARCHAR(255),
    comprovante_url VARCHAR(500),
    
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN (
        'pendente', 'aprovado', 'pago', 'cancelado', 'vencido'
    )),
    
    aprovado_por UUID REFERENCES profiles(id),
    aprovado_em TIMESTAMPTZ,
    pago_por UUID REFERENCES profiles(id),
    
    observacao TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MOVIMENTAÇÕES FINANCEIRAS (Extrato)
CREATE TABLE IF NOT EXISTS movimentacoes_financeiras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    categoria VARCHAR(50) NOT NULL,
    
    referencia_tipo VARCHAR(50),
    referencia_id UUID,
    
    valor DECIMAL(12,2) NOT NULL,
    
    data_movimentacao DATE NOT NULL,
    data_competencia DATE,
    
    descricao VARCHAR(255) NOT NULL,
    observacao TEXT,
    
    registrado_por UUID REFERENCES profiles(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_faturamentos_ref ON faturamentos(referencia_ano, referencia_mes);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento ON contas_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_categoria ON contas_pagar(categoria);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes_financeiras(data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON movimentacoes_financeiras(tipo);

-- RLS POLICIES
ALTER TABLE faturamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage faturamentos" ON faturamentos FOR ALL
USING (is_funcionario(auth.uid()));

ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage contas_pagar" ON contas_pagar FOR ALL
USING (is_funcionario(auth.uid()));

ALTER TABLE movimentacoes_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage movimentacoes" ON movimentacoes_financeiras FOR ALL
USING (is_funcionario(auth.uid()));
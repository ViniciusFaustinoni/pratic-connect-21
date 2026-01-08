-- =====================================================
-- MÓDULO: EXTRATO BANCÁRIO - SGA PRATIC 2.0
-- =====================================================

-- TABELA: contas_bancarias
CREATE TABLE public.contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banco_codigo VARCHAR(3) NOT NULL,
  banco_nome VARCHAR(100) NOT NULL,
  agencia VARCHAR(10) NOT NULL,
  conta VARCHAR(20) NOT NULL,
  digito VARCHAR(2),
  tipo VARCHAR(20) DEFAULT 'corrente' CHECK (tipo IN ('corrente', 'poupanca', 'investimento')),
  descricao VARCHAR(200),
  saldo_atual DECIMAL(15,2) DEFAULT 0,
  data_saldo DATE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(banco_codigo, agencia, conta)
);

-- TABELA: extratos_bancarios
CREATE TABLE public.extratos_bancarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  arquivo_nome VARCHAR(255) NOT NULL,
  arquivo_path VARCHAR(500),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  saldo_inicial DECIMAL(15,2),
  saldo_final DECIMAL(15,2),
  total_creditos DECIMAL(15,2) DEFAULT 0,
  total_debitos DECIMAL(15,2) DEFAULT 0,
  qtd_lancamentos INTEGER DEFAULT 0,
  qtd_conciliados INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'processado', 'conciliado', 'erro')),
  erro_mensagem TEXT,
  importado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABELA: movimentacoes_bancarias
CREATE TABLE public.movimentacoes_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extrato_id UUID REFERENCES public.extratos_bancarios(id) ON DELETE CASCADE,
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  data_lancamento DATE NOT NULL,
  descricao TEXT NOT NULL,
  documento VARCHAR(50),
  valor DECIMAL(15,2) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('credito', 'debito')),
  saldo_apos DECIMAL(15,2),
  categoria VARCHAR(50),
  subcategoria VARCHAR(50),
  origem_pagamento VARCHAR(50),
  nome_pagador VARCHAR(200),
  documento_pagador VARCHAR(20),
  data_origem DATE,
  conciliado BOOLEAN DEFAULT FALSE,
  cobranca_id UUID REFERENCES public.cobrancas(id),
  observacao_conciliacao TEXT,
  conciliado_por UUID REFERENCES public.profiles(id),
  conciliado_em TIMESTAMP WITH TIME ZONE,
  hash_lancamento VARCHAR(64) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABELA: regras_categorizacao
CREATE TABLE public.regras_categorizacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  padrao_texto VARCHAR(200) NOT NULL,
  tipo_match VARCHAR(20) DEFAULT 'contains' CHECK (tipo_match IN ('contains', 'starts_with', 'ends_with', 'regex')),
  categoria VARCHAR(50) NOT NULL,
  subcategoria VARCHAR(50),
  origem_pagamento VARCHAR(50),
  prioridade INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX idx_movbancarias_extrato ON public.movimentacoes_bancarias(extrato_id);
CREATE INDEX idx_movbancarias_conta ON public.movimentacoes_bancarias(conta_bancaria_id);
CREATE INDEX idx_movbancarias_data ON public.movimentacoes_bancarias(data_lancamento);
CREATE INDEX idx_movbancarias_conciliado ON public.movimentacoes_bancarias(conciliado);
CREATE INDEX idx_movbancarias_categoria ON public.movimentacoes_bancarias(categoria);
CREATE INDEX idx_extbancarios_conta ON public.extratos_bancarios(conta_bancaria_id);
CREATE INDEX idx_extbancarios_status ON public.extratos_bancarios(status);

-- RLS
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extratos_bancarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_categorizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contas_bancarias_select" ON public.contas_bancarias FOR SELECT TO authenticated USING (true);
CREATE POLICY "contas_bancarias_all" ON public.contas_bancarias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "extratos_bancarios_select" ON public.extratos_bancarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "extratos_bancarios_all" ON public.extratos_bancarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "movimentacoes_bancarias_select" ON public.movimentacoes_bancarias FOR SELECT TO authenticated USING (true);
CREATE POLICY "movimentacoes_bancarias_all" ON public.movimentacoes_bancarias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "regras_categorizacao_select" ON public.regras_categorizacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "regras_categorizacao_all" ON public.regras_categorizacao FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- DADOS INICIAIS
INSERT INTO public.regras_categorizacao (padrao_texto, tipo_match, categoria, subcategoria, origem_pagamento, prioridade) VALUES
('TRANSFERENCIA PIX REM:', 'starts_with', 'receita', 'pix_recebido', 'pix', 100),
('TRANSFERENCIA PIX DES:', 'starts_with', 'despesa', 'pix_enviado', 'pix', 100),
('VENDA CARTAO DE CREDITO', 'contains', 'receita', 'venda_cartao', 'cartao_credito', 90),
('CARTAO VISA ELECTRON', 'contains', 'receita', 'venda_cartao', 'cartao_debito', 90),
('CIELO VDA DEBITO', 'contains', 'receita', 'venda_cartao', 'cartao_debito', 90),
('CIELO', 'contains', 'receita', 'venda_cartao', 'cartao', 50),
('PAGTO ELETRON COBRANCA', 'starts_with', 'despesa', 'pagamento_fornecedor', 'boleto', 80),
('TED', 'contains', 'transferencia', 'ted', 'ted', 60),
('DOC', 'contains', 'transferencia', 'doc', 'doc', 60),
('TARIFA', 'contains', 'despesa', 'tarifa_bancaria', 'debito_automatico', 70),
('IOF', 'contains', 'despesa', 'imposto', 'debito_automatico', 70);

-- FUNCTION: Hash
CREATE OR REPLACE FUNCTION public.gerar_hash_lancamento(
  p_conta_id UUID, p_data DATE, p_descricao TEXT, p_valor DECIMAL, p_documento VARCHAR
) RETURNS VARCHAR AS $$
BEGIN
  RETURN encode(sha256((COALESCE(p_conta_id::text, '') || COALESCE(p_data::text, '') || COALESCE(p_descricao, '') || COALESCE(p_valor::text, '') || COALESCE(p_documento, ''))::bytea), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- VIEW
CREATE OR REPLACE VIEW public.view_movimentacoes_diarias AS
SELECT conta_bancaria_id, data_lancamento, COUNT(*) as qtd_lancamentos,
  SUM(CASE WHEN tipo = 'credito' THEN valor ELSE 0 END) as total_creditos,
  SUM(CASE WHEN tipo = 'debito' THEN ABS(valor) ELSE 0 END) as total_debitos,
  SUM(CASE WHEN tipo = 'credito' THEN valor ELSE -ABS(valor) END) as saldo_dia,
  COUNT(CASE WHEN conciliado THEN 1 END) as qtd_conciliados
FROM public.movimentacoes_bancarias GROUP BY conta_bancaria_id, data_lancamento ORDER BY data_lancamento DESC;

-- TRIGGERS
CREATE TRIGGER set_updated_at_contas_bancarias BEFORE UPDATE ON public.contas_bancarias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_extratos_bancarios BEFORE UPDATE ON public.extratos_bancarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_movimentacoes_bancarias BEFORE UPDATE ON public.movimentacoes_bancarias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
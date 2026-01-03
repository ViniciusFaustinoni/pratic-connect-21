-- Criar tabela cobrancas
CREATE TABLE public.cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relacionamentos
  associado_id UUID NOT NULL REFERENCES associados(id),
  veiculo_id UUID REFERENCES veiculos(id),
  contrato_id UUID REFERENCES contratos(id),
  
  -- Dados da cobrança
  tipo VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'aguardando_pagamento',
  descricao TEXT,
  
  -- Referência temporal
  referencia_mes INTEGER,
  referencia_ano INTEGER,
  
  -- Valores
  valor NUMERIC(12,2) NOT NULL,
  desconto NUMERIC(12,2) DEFAULT 0,
  juros NUMERIC(12,2) DEFAULT 0,
  multa NUMERIC(12,2) DEFAULT 0,
  valor_final NUMERIC(12,2) NOT NULL,
  valor_pago NUMERIC(12,2),
  
  -- Datas
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  
  -- Pagamento
  forma_pagamento VARCHAR(50),
  comprovante_url TEXT,
  
  -- PIX
  pix_qrcode TEXT,
  pix_copia_cola TEXT,
  pix_expiracao TIMESTAMPTZ,
  
  -- Boleto
  linha_digitavel VARCHAR(100),
  codigo_barras VARCHAR(60),
  boleto_url TEXT,
  nosso_numero VARCHAR(50),
  
  -- Cancelamento
  motivo_cancelamento TEXT,
  cancelado_por UUID REFERENCES profiles(id),
  
  -- Auditoria
  criado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_cobrancas_associado ON cobrancas(associado_id);
CREATE INDEX idx_cobrancas_status ON cobrancas(status);
CREATE INDEX idx_cobrancas_vencimento ON cobrancas(data_vencimento);
CREATE INDEX idx_cobrancas_referencia ON cobrancas(referencia_mes, referencia_ano);

-- Trigger updated_at
CREATE TRIGGER update_cobrancas_updated_at
  BEFORE UPDATE ON cobrancas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE cobrancas ENABLE ROW LEVEL SECURITY;

-- Funcionários veem todas
CREATE POLICY "cobrancas_select_funcionario" ON cobrancas 
  FOR SELECT USING (is_funcionario(auth.uid()));

-- Associado vê as suas
CREATE POLICY "cobrancas_select_associado" ON cobrancas 
  FOR SELECT USING (associado_id = get_my_associado_id(auth.uid()));

-- Funcionários podem inserir
CREATE POLICY "cobrancas_insert_funcionario" ON cobrancas 
  FOR INSERT WITH CHECK (is_funcionario(auth.uid()));

-- Funcionários podem atualizar
CREATE POLICY "cobrancas_update_funcionario" ON cobrancas 
  FOR UPDATE USING (is_funcionario(auth.uid()));

-- Functions
CREATE OR REPLACE FUNCTION atualizar_cobrancas_vencidas()
RETURNS INTEGER AS $$
DECLARE qtd_atualizadas INTEGER;
BEGIN
  UPDATE cobrancas
  SET status = 'vencido', updated_at = NOW()
  WHERE status = 'aguardando_pagamento' AND data_vencimento < CURRENT_DATE;
  
  GET DIAGNOSTICS qtd_atualizadas = ROW_COUNT;
  RETURN qtd_atualizadas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_estatisticas_cobrancas_mes(p_mes INTEGER, p_ano INTEGER)
RETURNS JSON AS $$
DECLARE resultado JSON;
BEGIN
  SELECT json_build_object(
    'total_cobrancas', COUNT(*),
    'valor_faturado', COALESCE(SUM(valor_final), 0),
    'valor_recebido', COALESCE(SUM(valor_pago), 0),
    'qtd_pagas', COUNT(*) FILTER (WHERE status = 'pago'),
    'qtd_vencidas', COUNT(*) FILTER (WHERE status = 'vencido'),
    'qtd_pendentes', COUNT(*) FILTER (WHERE status = 'aguardando_pagamento')
  ) INTO resultado
  FROM cobrancas
  WHERE referencia_mes = p_mes AND referencia_ano = p_ano;
  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
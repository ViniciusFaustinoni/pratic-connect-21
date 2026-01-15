-- Tabela de Folha de Pagamento
CREATE TABLE IF NOT EXISTS folha_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL CHECK (ano >= 2020 AND ano <= 2100),
  
  -- Proventos
  salario_base DECIMAL(10,2) NOT NULL DEFAULT 0,
  horas_extras_qtd DECIMAL(5,2) DEFAULT 0,
  horas_extras_valor DECIMAL(10,2) DEFAULT 0,
  adicional_noturno DECIMAL(10,2) DEFAULT 0,
  comissoes DECIMAL(10,2) DEFAULT 0,
  bonus DECIMAL(10,2) DEFAULT 0,
  outros_proventos DECIMAL(10,2) DEFAULT 0,
  total_proventos DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Descontos
  inss DECIMAL(10,2) NOT NULL DEFAULT 0,
  irrf DECIMAL(10,2) NOT NULL DEFAULT 0,
  vale_transporte DECIMAL(10,2) DEFAULT 0,
  vale_refeicao DECIMAL(10,2) DEFAULT 0,
  plano_saude DECIMAL(10,2) DEFAULT 0,
  emprestimo_consignado DECIMAL(10,2) DEFAULT 0,
  adiantamento DECIMAL(10,2) DEFAULT 0,
  outros_descontos DECIMAL(10,2) DEFAULT 0,
  total_descontos DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Líquido
  salario_liquido DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Controle
  status VARCHAR(20) DEFAULT 'rascunho' 
    CHECK (status IN ('rascunho', 'calculado', 'aprovado', 'pago', 'cancelado')),
  observacoes TEXT,
  calculado_por UUID REFERENCES profiles(id),
  calculado_em TIMESTAMPTZ,
  aprovado_por UUID REFERENCES profiles(id),
  aprovado_em TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(funcionario_id, mes, ano)
);

-- Índices para performance
CREATE INDEX idx_folha_funcionario ON folha_pagamento(funcionario_id);
CREATE INDEX idx_folha_periodo ON folha_pagamento(ano, mes);
CREATE INDEX idx_folha_status ON folha_pagamento(status);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_folha_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER folha_pagamento_updated_at
  BEFORE UPDATE ON folha_pagamento
  FOR EACH ROW EXECUTE FUNCTION update_folha_updated_at();

-- RLS
ALTER TABLE folha_pagamento ENABLE ROW LEVEL SECURITY;

-- Política para funcionários autenticados com perfil ativo
CREATE POLICY "Funcionarios podem ver folha de pagamento" ON folha_pagamento
  FOR SELECT TO authenticated
  USING (
    is_funcionario(auth.uid()) OR is_gerencia(auth.uid())
  );

-- Política para gerência gerenciar folha
CREATE POLICY "Gerencia pode gerenciar folha" ON folha_pagamento
  FOR ALL TO authenticated
  USING (is_gerencia(auth.uid()))
  WITH CHECK (is_gerencia(auth.uid()));
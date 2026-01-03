-- Tabela de Metas de Vendas
CREATE TABLE IF NOT EXISTS metas_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vendedor (referência ao profile do vendedor)
  vendedor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Período
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL CHECK (ano >= 2024),
  
  -- Metas definidas
  meta_leads INTEGER DEFAULT 0,
  meta_cotacoes INTEGER DEFAULT 0,
  meta_contratos INTEGER DEFAULT 0,
  meta_valor DECIMAL(12, 2) DEFAULT 0,
  
  -- Realizado (atualizado via aplicação)
  realizado_leads INTEGER DEFAULT 0,
  realizado_cotacoes INTEGER DEFAULT 0,
  realizado_contratos INTEGER DEFAULT 0,
  realizado_valor DECIMAL(12, 2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unicidade por vendedor/período
  UNIQUE(vendedor_id, mes, ano)
);

-- Índices para performance
CREATE INDEX idx_metas_vendedor ON metas_vendas(vendedor_id);
CREATE INDEX idx_metas_periodo ON metas_vendas(ano, mes);

-- RLS
ALTER TABLE metas_vendas ENABLE ROW LEVEL SECURITY;

-- Funcionários podem visualizar metas
CREATE POLICY "Funcionarios podem ver metas"
  ON metas_vendas FOR SELECT
  TO authenticated
  USING (is_funcionario(auth.uid()));

-- Gerência pode gerenciar metas (INSERT, UPDATE, DELETE)
CREATE POLICY "Gerencia pode gerenciar metas"
  ON metas_vendas FOR ALL
  TO authenticated
  USING (is_gerencia(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_metas_vendas_updated_at
  BEFORE UPDATE ON metas_vendas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
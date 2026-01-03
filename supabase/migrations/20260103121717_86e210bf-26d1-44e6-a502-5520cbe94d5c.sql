-- =====================================================
-- TABELA: estoque_movimentacoes
-- Histórico de movimentações de rastreadores no estoque
-- =====================================================

-- 1. CRIAR TABELA
CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rastreador (pode ser NULL para entradas em lote)
  rastreador_id UUID REFERENCES rastreadores(id) ON DELETE SET NULL,
  
  -- Tipo de movimentação
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN (
    'entrada',
    'saida',
    'transferencia',
    'baixa',
    'manutencao',
    'retorno_manutencao'
  )),
  
  -- Quantidade movimentada
  quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  
  -- Status do rastreador (antes e depois)
  status_anterior VARCHAR(20),
  status_novo VARCHAR(20),
  
  -- Referências opcionais
  instalacao_id UUID REFERENCES instalacoes(id) ON DELETE SET NULL,
  veiculo_id UUID REFERENCES veiculos(id) ON DELETE SET NULL,
  
  -- Detalhes da movimentação
  motivo TEXT,
  observacoes TEXT,
  nota_fiscal VARCHAR(50),
  fornecedor VARCHAR(100),
  
  -- Responsável pela movimentação
  usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_estoque_mov_rastreador ON estoque_movimentacoes(rastreador_id);
CREATE INDEX idx_estoque_mov_tipo ON estoque_movimentacoes(tipo);
CREATE INDEX idx_estoque_mov_data ON estoque_movimentacoes(created_at DESC);
CREATE INDEX idx_estoque_mov_usuario ON estoque_movimentacoes(usuario_id);
CREATE INDEX idx_estoque_mov_nf ON estoque_movimentacoes(nota_fiscal) WHERE nota_fiscal IS NOT NULL;

-- 3. HABILITAR RLS
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

-- 4. CRIAR POLÍTICAS DE ACESSO (usando função existente is_funcionario)
CREATE POLICY "Staff can view stock movements"
  ON estoque_movimentacoes FOR SELECT
  USING (is_funcionario(auth.uid()));

CREATE POLICY "Staff can insert stock movements"
  ON estoque_movimentacoes FOR INSERT
  WITH CHECK (is_funcionario(auth.uid()));

CREATE POLICY "Staff can update stock movements"
  ON estoque_movimentacoes FOR UPDATE
  USING (is_funcionario(auth.uid()));

-- 5. CRIAR TRIGGER PARA UPDATED_AT (reutilizando função existente)
CREATE TRIGGER update_estoque_movimentacoes_updated_at
  BEFORE UPDATE ON estoque_movimentacoes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. COMENTÁRIOS
COMMENT ON TABLE estoque_movimentacoes IS 'Histórico de movimentações de rastreadores no estoque';
COMMENT ON COLUMN estoque_movimentacoes.tipo IS 'Tipo: entrada, saida, transferencia, baixa, manutencao, retorno_manutencao';
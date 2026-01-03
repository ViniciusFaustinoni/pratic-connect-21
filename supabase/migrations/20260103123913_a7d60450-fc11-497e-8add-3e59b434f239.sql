-- =====================================================
-- MÓDULO 4 - PROMPT 08 - SISTEMA DE ALERTAS
-- =====================================================

-- =====================================================
-- 1. TABELA DE ALERTAS
-- =====================================================

CREATE TABLE IF NOT EXISTS rastreador_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rastreador_id UUID NOT NULL REFERENCES rastreadores(id) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
    'sem_comunicacao',
    'bateria_baixa',
    'velocidade_alta',
    'fora_cerca',
    'panico',
    'ignicao_forcada',
    'violacao'
  )),
  severidade VARCHAR(10) NOT NULL CHECK (severidade IN (
    'baixa',
    'media',
    'alta',
    'critica'
  )),
  mensagem TEXT NOT NULL,
  dados JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'aberto' CHECK (status IN (
    'aberto',
    'visualizado',
    'tratado',
    'ignorado'
  )),
  tratado_por UUID REFERENCES profiles(id),
  tratado_em TIMESTAMPTZ,
  observacao_tratamento TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE rastreador_alertas IS 'Alertas de rastreadores (sem comunicação, bateria baixa, etc)';

-- =====================================================
-- 2. ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_alertas_rastreador 
  ON rastreador_alertas(rastreador_id);

CREATE INDEX IF NOT EXISTS idx_alertas_tipo 
  ON rastreador_alertas(tipo);

CREATE INDEX IF NOT EXISTS idx_alertas_status 
  ON rastreador_alertas(status);

CREATE INDEX IF NOT EXISTS idx_alertas_severidade 
  ON rastreador_alertas(severidade);

CREATE INDEX IF NOT EXISTS idx_alertas_created 
  ON rastreador_alertas(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alertas_ativos 
  ON rastreador_alertas(status, created_at DESC) 
  WHERE status IN ('aberto', 'visualizado');

-- =====================================================
-- 3. RLS (Row Level Security)
-- =====================================================

ALTER TABLE rastreador_alertas ENABLE ROW LEVEL SECURITY;

-- Funcionários podem ver todos os alertas
CREATE POLICY "Staff can view alerts"
  ON rastreador_alertas FOR SELECT
  TO authenticated
  USING (is_funcionario(auth.uid()));

-- Funcionários podem atualizar alertas (tratar/ignorar)
CREATE POLICY "Staff can update alerts"
  ON rastreador_alertas FOR UPDATE
  TO authenticated
  USING (is_funcionario(auth.uid()));

-- Sistema pode inserir alertas
CREATE POLICY "System can insert alerts"
  ON rastreador_alertas FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================
-- 4. TRIGGER PARA UPDATED_AT
-- =====================================================

CREATE TRIGGER trigger_alertas_updated_at
  BEFORE UPDATE ON rastreador_alertas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. VIEW DE ALERTAS ATIVOS COM DADOS COMPLETOS
-- =====================================================

CREATE OR REPLACE VIEW view_alertas_ativos AS
SELECT 
  a.id,
  a.rastreador_id,
  a.tipo,
  a.severidade,
  a.mensagem,
  a.dados,
  a.status,
  a.created_at,
  a.updated_at,
  r.codigo AS rastreador_codigo,
  r.plataforma,
  r.ultima_comunicacao,
  v.id AS veiculo_id,
  v.placa,
  v.marca,
  v.modelo,
  ass.id AS associado_id,
  ass.nome AS associado_nome,
  ass.telefone AS associado_telefone,
  ass.email AS associado_email,
  ROUND(EXTRACT(EPOCH FROM (NOW() - a.created_at)) / 3600, 1) AS horas_aberto
FROM rastreador_alertas a
JOIN rastreadores r ON r.id = a.rastreador_id
LEFT JOIN veiculos v ON r.veiculo_id = v.id
LEFT JOIN associados ass ON v.associado_id = ass.id
WHERE a.status IN ('aberto', 'visualizado')
ORDER BY 
  CASE a.severidade 
    WHEN 'critica' THEN 1 
    WHEN 'alta' THEN 2 
    WHEN 'media' THEN 3 
    ELSE 4 
  END,
  a.created_at DESC;

COMMENT ON VIEW view_alertas_ativos IS 'Alertas abertos/visualizados com dados do veículo e associado';

-- =====================================================
-- 6. FUNÇÃO PARA CONTAR ALERTAS POR STATUS
-- =====================================================

CREATE OR REPLACE FUNCTION get_alertas_contagem()
RETURNS TABLE (
  abertos BIGINT,
  visualizados BIGINT,
  criticos BIGINT,
  total BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'aberto') AS abertos,
    COUNT(*) FILTER (WHERE status = 'visualizado') AS visualizados,
    COUNT(*) FILTER (WHERE severidade = 'critica' AND status IN ('aberto', 'visualizado')) AS criticos,
    COUNT(*) FILTER (WHERE status IN ('aberto', 'visualizado')) AS total
  FROM rastreador_alertas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
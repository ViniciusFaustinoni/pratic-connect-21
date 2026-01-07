-- ============================================
-- ATUALIZAR TABELA: distribuicao_leads_config
-- ============================================

ALTER TABLE distribuicao_leads_config 
ADD COLUMN IF NOT EXISTS limite_diario_padrao INTEGER DEFAULT 20;

ALTER TABLE distribuicao_leads_config 
ADD COLUMN IF NOT EXISTS resetar_contadores_hora INTEGER DEFAULT 0;

ALTER TABLE distribuicao_leads_config 
ADD COLUMN IF NOT EXISTS fallback_vendedor_id UUID REFERENCES profiles(id);

ALTER TABLE distribuicao_leads_config 
ADD COLUMN IF NOT EXISTS distribuir_fins_semana BOOLEAN DEFAULT FALSE;

-- ============================================
-- ATUALIZAR TABELA: distribuicao_leads_vendedores
-- ============================================

ALTER TABLE distribuicao_leads_vendedores 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ativo';

ALTER TABLE distribuicao_leads_vendedores
ADD CONSTRAINT distribuicao_status_check 
CHECK (status IN ('ativo', 'pausado', 'ferias', 'inativo'));

ALTER TABLE distribuicao_leads_vendedores 
ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;

ALTER TABLE distribuicao_leads_vendedores 
ADD COLUMN IF NOT EXISTS total_leads_historico INTEGER DEFAULT 0;

ALTER TABLE distribuicao_leads_vendedores 
ADD COLUMN IF NOT EXISTS ultima_atribuicao TIMESTAMPTZ;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dist_vendedores_status 
ON distribuicao_leads_vendedores(status);

CREATE INDEX IF NOT EXISTS idx_dist_vendedores_ordem 
ON distribuicao_leads_vendedores(ordem);

-- ============================================
-- CRIAR TABELA: distribuicao_leads_historico
-- ============================================

CREATE TABLE IF NOT EXISTS distribuicao_leads_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  vendedor_id UUID REFERENCES profiles(id),
  vendedor_anterior_id UUID REFERENCES profiles(id),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('automatica', 'manual', 'fallback', 'reatribuicao')),
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE distribuicao_leads_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem ver historico distribuicao" 
ON distribuicao_leads_historico
FOR SELECT USING (am_i_funcionario());

CREATE POLICY "Sistema pode inserir historico distribuicao" 
ON distribuicao_leads_historico
FOR INSERT WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_dist_historico_lead ON distribuicao_leads_historico(lead_id);
CREATE INDEX IF NOT EXISTS idx_dist_historico_vendedor ON distribuicao_leads_historico(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_dist_historico_data ON distribuicao_leads_historico(created_at DESC);

-- ============================================
-- FUNÇÃO: distribuir_lead_round_robin
-- ============================================

CREATE OR REPLACE FUNCTION distribuir_lead_round_robin(p_lead_id UUID)
RETURNS UUID AS $$
DECLARE
  v_config RECORD;
  v_vendedor RECORD;
  v_vendedor_id UUID;
  v_proximo_ordem INTEGER;
BEGIN
  -- Buscar configuração
  SELECT * INTO v_config FROM distribuicao_leads_config LIMIT 1;
  
  -- Se distribuição não está ativa, retornar null
  IF v_config IS NULL OR NOT v_config.ativo THEN
    RETURN NULL;
  END IF;
  
  -- Verificar se é fim de semana
  IF NOT COALESCE(v_config.distribuir_fins_semana, FALSE) AND 
     EXTRACT(DOW FROM NOW()) IN (0, 6) THEN
    RETURN NULL;
  END IF;
  
  -- Buscar próximo vendedor disponível (a partir da ordem atual)
  SELECT * INTO v_vendedor
  FROM distribuicao_leads_vendedores
  WHERE COALESCE(status, 'ativo') = 'ativo'
    AND recebendo_leads = TRUE
    AND (max_leads_dia IS NULL OR max_leads_dia = 0 OR leads_recebidos_hoje < max_leads_dia)
    AND ordem >= COALESCE(v_config.proximo_vendedor, 0)
  ORDER BY ordem ASC
  LIMIT 1;
  
  -- Se não encontrou, buscar do início (round-robin)
  IF v_vendedor IS NULL THEN
    SELECT * INTO v_vendedor
    FROM distribuicao_leads_vendedores
    WHERE COALESCE(status, 'ativo') = 'ativo'
      AND recebendo_leads = TRUE
      AND (max_leads_dia IS NULL OR max_leads_dia = 0 OR leads_recebidos_hoje < max_leads_dia)
    ORDER BY ordem ASC
    LIMIT 1;
  END IF;
  
  -- Se ainda não encontrou, usar fallback
  IF v_vendedor IS NULL THEN
    v_vendedor_id := v_config.fallback_vendedor_id;
    
    IF v_vendedor_id IS NOT NULL THEN
      -- Registrar no histórico como fallback
      INSERT INTO distribuicao_leads_historico 
        (lead_id, vendedor_id, tipo, motivo)
      VALUES 
        (p_lead_id, v_vendedor_id, 'fallback', 'Nenhum vendedor disponível');
    END IF;
  ELSE
    v_vendedor_id := v_vendedor.vendedor_id;
    v_proximo_ordem := v_vendedor.ordem + 1;
    
    -- Atualizar contador do vendedor
    UPDATE distribuicao_leads_vendedores
    SET 
      leads_recebidos_hoje = COALESCE(leads_recebidos_hoje, 0) + 1,
      total_leads_historico = COALESCE(total_leads_historico, 0) + 1,
      ultima_atribuicao = NOW(),
      updated_at = NOW()
    WHERE id = v_vendedor.id;
    
    -- Atualizar ponteiro da fila
    UPDATE distribuicao_leads_config
    SET proximo_vendedor = v_proximo_ordem, updated_at = NOW()
    WHERE id = v_config.id;
    
    -- Registrar no histórico
    INSERT INTO distribuicao_leads_historico 
      (lead_id, vendedor_id, tipo, motivo)
    VALUES 
      (p_lead_id, v_vendedor_id, 'automatica', 'Round-robin');
  END IF;
  
  -- Atribuir lead ao vendedor
  IF v_vendedor_id IS NOT NULL THEN
    UPDATE leads SET vendedor_id = v_vendedor_id WHERE id = p_lead_id;
  END IF;
  
  RETURN v_vendedor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO: resetar_contadores_diarios
-- ============================================

CREATE OR REPLACE FUNCTION resetar_contadores_diarios()
RETURNS void AS $$
BEGIN
  UPDATE distribuicao_leads_vendedores
  SET 
    leads_recebidos_hoje = 0,
    updated_at = NOW();
    
  -- Reset do ponteiro também
  UPDATE distribuicao_leads_config
  SET proximo_vendedor = 0, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- TRIGGER: distribuir lead automaticamente
-- ============================================

CREATE OR REPLACE FUNCTION trigger_distribuir_lead()
RETURNS TRIGGER AS $$
BEGIN
  -- Só distribuir se o lead foi criado sem vendedor
  IF NEW.vendedor_id IS NULL THEN
    PERFORM distribuir_lead_round_robin(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Dropar trigger se existir para recriar
DROP TRIGGER IF EXISTS trg_distribuir_lead_novo ON leads;

CREATE TRIGGER trg_distribuir_lead_novo
AFTER INSERT ON leads
FOR EACH ROW
EXECUTE FUNCTION trigger_distribuir_lead();
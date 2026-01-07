-- ============================================
-- 1. INSERIR CONFIGURAÇÃO PADRÃO (se não existir)
-- ============================================
INSERT INTO distribuicao_leads_config (tipo, ativo, limite_diario_padrao, resetar_contadores_hora, distribuir_fins_semana, proximo_vendedor)
SELECT 'round_robin', true, 20, 0, false, 0
WHERE NOT EXISTS (SELECT 1 FROM distribuicao_leads_config LIMIT 1);

-- ============================================
-- 2. ADICIONAR COLUNA leads_recebidos_mes SE NÃO EXISTIR
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'distribuicao_leads_vendedores' 
    AND column_name = 'leads_recebidos_mes'
  ) THEN
    ALTER TABLE distribuicao_leads_vendedores 
    ADD COLUMN leads_recebidos_mes INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- 3. DROPAR TRIGGERS EXISTENTES
-- ============================================
DROP TRIGGER IF EXISTS trg_distribuir_lead_novo ON leads;
DROP TRIGGER IF EXISTS trg_historico_distribuicao ON leads;

-- ============================================
-- 4. MELHORAR FUNÇÃO distribuir_lead_round_robin
-- ============================================
CREATE OR REPLACE FUNCTION distribuir_lead_round_robin(p_lead_id UUID)
RETURNS UUID AS $$
DECLARE
  v_config RECORD;
  v_vendedor RECORD;
  v_vendedor_id UUID;
  v_proximo_ordem INTEGER;
  v_tipo_atribuicao VARCHAR(20);
  v_motivo TEXT;
BEGIN
  -- Buscar configuração
  SELECT * INTO v_config FROM distribuicao_leads_config LIMIT 1;
  
  -- Se não há config ou distribuição não está ativa
  IF v_config IS NULL OR NOT COALESCE(v_config.ativo, false) THEN
    RETURN NULL;
  END IF;
  
  -- Verificar se é fim de semana
  IF NOT COALESCE(v_config.distribuir_fins_semana, FALSE) AND 
     EXTRACT(DOW FROM NOW()) IN (0, 6) THEN
    -- Usar fallback se disponível
    IF v_config.fallback_vendedor_id IS NOT NULL THEN
      v_vendedor_id := v_config.fallback_vendedor_id;
      v_tipo_atribuicao := 'fallback';
      v_motivo := 'Fim de semana - distribuição pausada';
      
      UPDATE leads SET vendedor_id = v_vendedor_id WHERE id = p_lead_id;
      
      INSERT INTO distribuicao_leads_historico (lead_id, vendedor_id, tipo, motivo)
      VALUES (p_lead_id, v_vendedor_id, v_tipo_atribuicao, v_motivo);
        
      RETURN v_vendedor_id;
    ELSE
      RETURN NULL;
    END IF;
  END IF;
  
  -- Buscar próximo vendedor disponível (a partir da ordem atual)
  SELECT dlv.* INTO v_vendedor
  FROM distribuicao_leads_vendedores dlv
  INNER JOIN profiles p ON p.id = dlv.vendedor_id
  WHERE COALESCE(dlv.status, 'ativo') = 'ativo'
    AND dlv.recebendo_leads = TRUE
    AND p.ativo = TRUE
    AND COALESCE(p.bloqueado, false) = FALSE
    AND (dlv.max_leads_dia IS NULL OR dlv.max_leads_dia = 0 OR dlv.leads_recebidos_hoje < dlv.max_leads_dia)
    AND dlv.ordem >= COALESCE(v_config.proximo_vendedor, 0)
  ORDER BY dlv.ordem ASC
  LIMIT 1;
  
  -- Se não encontrou, buscar do início (round-robin completo)
  IF v_vendedor IS NULL THEN
    SELECT dlv.* INTO v_vendedor
    FROM distribuicao_leads_vendedores dlv
    INNER JOIN profiles p ON p.id = dlv.vendedor_id
    WHERE COALESCE(dlv.status, 'ativo') = 'ativo'
      AND dlv.recebendo_leads = TRUE
      AND p.ativo = TRUE
      AND COALESCE(p.bloqueado, false) = FALSE
      AND (dlv.max_leads_dia IS NULL OR dlv.max_leads_dia = 0 OR dlv.leads_recebidos_hoje < dlv.max_leads_dia)
    ORDER BY dlv.ordem ASC
    LIMIT 1;
  END IF;
  
  -- Processar resultado
  IF v_vendedor IS NULL THEN
    v_vendedor_id := v_config.fallback_vendedor_id;
    v_tipo_atribuicao := 'fallback';
    v_motivo := 'Nenhum vendedor disponível';
  ELSE
    v_vendedor_id := v_vendedor.vendedor_id;
    v_proximo_ordem := v_vendedor.ordem + 1;
    v_tipo_atribuicao := 'automatica';
    v_motivo := 'Round-robin';
    
    -- Atualizar contadores do vendedor
    UPDATE distribuicao_leads_vendedores
    SET 
      leads_recebidos_hoje = COALESCE(leads_recebidos_hoje, 0) + 1,
      leads_recebidos_mes = COALESCE(leads_recebidos_mes, 0) + 1,
      total_leads_historico = COALESCE(total_leads_historico, 0) + 1,
      ultima_atribuicao = NOW(),
      updated_at = NOW()
    WHERE id = v_vendedor.id;
    
    -- Atualizar ponteiro da fila
    UPDATE distribuicao_leads_config
    SET proximo_vendedor = v_proximo_ordem, updated_at = NOW()
    WHERE id = v_config.id;
  END IF;
  
  -- Atribuir lead ao vendedor
  IF v_vendedor_id IS NOT NULL THEN
    UPDATE leads SET vendedor_id = v_vendedor_id WHERE id = p_lead_id;
    
    INSERT INTO distribuicao_leads_historico (lead_id, vendedor_id, tipo, motivo)
    VALUES (p_lead_id, v_vendedor_id, v_tipo_atribuicao, v_motivo);
  END IF;
  
  RETURN v_vendedor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ============================================
-- 5. RECRIAR TRIGGER FUNCTION (BEFORE INSERT)
-- ============================================
CREATE OR REPLACE FUNCTION trigger_distribuir_lead()
RETURNS TRIGGER AS $$
DECLARE
  v_config RECORD;
  v_vendedor RECORD;
  v_proximo_ordem INTEGER;
BEGIN
  -- Só distribuir se não tiver vendedor
  IF NEW.vendedor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Buscar configuração
  SELECT * INTO v_config FROM distribuicao_leads_config LIMIT 1;
  
  -- Se não há config ou distribuição não está ativa
  IF v_config IS NULL OR NOT COALESCE(v_config.ativo, false) THEN
    RETURN NEW;
  END IF;
  
  -- Verificar fim de semana
  IF NOT COALESCE(v_config.distribuir_fins_semana, FALSE) AND 
     EXTRACT(DOW FROM NOW()) IN (0, 6) THEN
    NEW.vendedor_id := v_config.fallback_vendedor_id;
    RETURN NEW;
  END IF;
  
  -- Buscar próximo vendedor disponível
  SELECT dlv.* INTO v_vendedor
  FROM distribuicao_leads_vendedores dlv
  INNER JOIN profiles p ON p.id = dlv.vendedor_id
  WHERE COALESCE(dlv.status, 'ativo') = 'ativo'
    AND dlv.recebendo_leads = TRUE
    AND p.ativo = TRUE
    AND COALESCE(p.bloqueado, false) = FALSE
    AND (dlv.max_leads_dia IS NULL OR dlv.max_leads_dia = 0 OR dlv.leads_recebidos_hoje < dlv.max_leads_dia)
    AND dlv.ordem >= COALESCE(v_config.proximo_vendedor, 0)
  ORDER BY dlv.ordem ASC
  LIMIT 1;
  
  -- Se não encontrou, buscar do início
  IF v_vendedor IS NULL THEN
    SELECT dlv.* INTO v_vendedor
    FROM distribuicao_leads_vendedores dlv
    INNER JOIN profiles p ON p.id = dlv.vendedor_id
    WHERE COALESCE(dlv.status, 'ativo') = 'ativo'
      AND dlv.recebendo_leads = TRUE
      AND p.ativo = TRUE
      AND COALESCE(p.bloqueado, false) = FALSE
      AND (dlv.max_leads_dia IS NULL OR dlv.max_leads_dia = 0 OR dlv.leads_recebidos_hoje < dlv.max_leads_dia)
    ORDER BY dlv.ordem ASC
    LIMIT 1;
  END IF;
  
  IF v_vendedor IS NOT NULL THEN
    NEW.vendedor_id := v_vendedor.vendedor_id;
    v_proximo_ordem := v_vendedor.ordem + 1;
    
    -- Atualizar contadores
    UPDATE distribuicao_leads_vendedores
    SET 
      leads_recebidos_hoje = COALESCE(leads_recebidos_hoje, 0) + 1,
      leads_recebidos_mes = COALESCE(leads_recebidos_mes, 0) + 1,
      total_leads_historico = COALESCE(total_leads_historico, 0) + 1,
      ultima_atribuicao = NOW(),
      updated_at = NOW()
    WHERE id = v_vendedor.id;
    
    -- Atualizar ponteiro
    UPDATE distribuicao_leads_config
    SET proximo_vendedor = v_proximo_ordem, updated_at = NOW()
    WHERE id = v_config.id;
  ELSE
    NEW.vendedor_id := v_config.fallback_vendedor_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Criar trigger BEFORE INSERT
CREATE TRIGGER trg_distribuir_lead_novo
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_distribuir_lead();

-- ============================================
-- 6. TRIGGER PARA HISTÓRICO (AFTER INSERT)
-- ============================================
CREATE OR REPLACE FUNCTION trigger_registrar_historico_distribuicao()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o lead foi atribuído a um vendedor via trigger, registrar no histórico
  IF NEW.vendedor_id IS NOT NULL THEN
    -- Evitar duplicatas - só registrar se não existir
    INSERT INTO distribuicao_leads_historico (lead_id, vendedor_id, tipo, motivo)
    SELECT NEW.id, NEW.vendedor_id, 'automatica', 'Atribuído via trigger'
    WHERE NOT EXISTS (
      SELECT 1 FROM distribuicao_leads_historico 
      WHERE lead_id = NEW.id AND vendedor_id = NEW.vendedor_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER trg_historico_distribuicao
  AFTER INSERT ON leads
  FOR EACH ROW
  WHEN (NEW.vendedor_id IS NOT NULL)
  EXECUTE FUNCTION trigger_registrar_historico_distribuicao();

-- ============================================
-- 7. MELHORAR FUNÇÃO DE RESET DIÁRIO
-- ============================================
CREATE OR REPLACE FUNCTION resetar_contadores_diarios()
RETURNS void AS $$
BEGIN
  UPDATE distribuicao_leads_vendedores
  SET 
    leads_recebidos_hoje = 0,
    updated_at = NOW();
  
  UPDATE distribuicao_leads_config
  SET 
    proximo_vendedor = 0, 
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ============================================
-- 8. CRIAR FUNÇÃO PARA RESET MENSAL
-- ============================================
CREATE OR REPLACE FUNCTION resetar_contadores_mensais()
RETURNS void AS $$
BEGIN
  UPDATE distribuicao_leads_vendedores
  SET 
    leads_recebidos_mes = 0,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ============================================
-- 9. ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dist_vendedores_status ON distribuicao_leads_vendedores(status);
CREATE INDEX IF NOT EXISTS idx_dist_vendedores_ordem ON distribuicao_leads_vendedores(ordem);
CREATE INDEX IF NOT EXISTS idx_dist_historico_lead ON distribuicao_leads_historico(lead_id);
CREATE INDEX IF NOT EXISTS idx_dist_historico_vendedor ON distribuicao_leads_historico(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_dist_historico_created ON distribuicao_leads_historico(created_at DESC);
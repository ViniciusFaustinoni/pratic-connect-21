-- ============================================
-- FASE 1: LIMPAR SISTEMA ANTIGO
-- ============================================

-- Dropar triggers existentes
DROP TRIGGER IF EXISTS trg_distribuir_lead_novo ON leads;
DROP TRIGGER IF EXISTS trg_historico_distribuicao ON leads;

-- Dropar funções existentes (com CASCADE para dependências)
DROP FUNCTION IF EXISTS trigger_distribuir_lead() CASCADE;
DROP FUNCTION IF EXISTS trigger_registrar_historico_distribuicao() CASCADE;
DROP FUNCTION IF EXISTS distribuir_lead_round_robin(UUID) CASCADE;
DROP FUNCTION IF EXISTS resetar_contadores_diarios() CASCADE;
DROP FUNCTION IF EXISTS resetar_contadores_mensais() CASCADE;

-- Dropar tabelas antigas
DROP TABLE IF EXISTS distribuicao_leads_historico CASCADE;
DROP TABLE IF EXISTS distribuicao_leads_vendedores CASCADE;
DROP TABLE IF EXISTS distribuicao_leads_config CASCADE;

-- ============================================
-- FASE 2: CRIAR NOVAS TABELAS
-- ============================================

-- Configuração geral
CREATE TABLE distribuicao_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ativo BOOLEAN DEFAULT true,
    limite_diario_padrao INTEGER DEFAULT 20,
    resetar_contadores_hora INTEGER DEFAULT 0 CHECK (resetar_contadores_hora BETWEEN 0 AND 23),
    fallback_usuario_id UUID REFERENCES profiles(id),
    distribuir_fins_semana BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendedores na distribuição
CREATE TABLE distribuicao_vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'ferias', 'inativo')),
    limite_diario INTEGER DEFAULT 0,
    leads_hoje INTEGER DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    ultima_atribuicao TIMESTAMPTZ,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendedor_id)
);

-- Histórico de atribuições
CREATE TABLE distribuicao_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES profiles(id),
    atribuido_automaticamente BOOLEAN DEFAULT true,
    motivo VARCHAR(50) DEFAULT 'round_robin' CHECK (motivo IN ('round_robin', 'fallback', 'manual', 'redistribuicao')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configuração padrão
INSERT INTO distribuicao_config (ativo, limite_diario_padrao) VALUES (true, 20);

-- ============================================
-- FASE 3: ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX idx_distribuicao_vendedores_status ON distribuicao_vendedores(status);
CREATE INDEX idx_distribuicao_vendedores_ordem ON distribuicao_vendedores(ordem);
CREATE INDEX idx_distribuicao_historico_lead ON distribuicao_historico(lead_id);
CREATE INDEX idx_distribuicao_historico_vendedor ON distribuicao_historico(vendedor_id);
CREATE INDEX idx_distribuicao_historico_data ON distribuicao_historico(created_at);

-- ============================================
-- FASE 4: FUNÇÃO - PRÓXIMO VENDEDOR (ROUND-ROBIN)
-- ============================================

CREATE OR REPLACE FUNCTION get_proximo_vendedor_distribuicao()
RETURNS UUID AS $$
DECLARE
    config_record RECORD;
    vendedor_record RECORD;
    limite_atual INTEGER;
BEGIN
    -- Buscar configuração
    SELECT * INTO config_record FROM distribuicao_config LIMIT 1;
    
    -- Verificar se distribuição está ativa
    IF config_record IS NULL OR NOT config_record.ativo THEN
        RETURN NULL;
    END IF;
    
    -- Verificar se é fim de semana
    IF NOT config_record.distribuir_fins_semana 
       AND EXTRACT(DOW FROM NOW()) IN (0, 6) THEN
        RETURN config_record.fallback_usuario_id;
    END IF;
    
    -- Buscar próximo vendedor disponível
    FOR vendedor_record IN 
        SELECT dv.*, p.ativo as usuario_ativo
        FROM distribuicao_vendedores dv
        JOIN profiles p ON p.id = dv.vendedor_id
        WHERE dv.status = 'ativo'
          AND p.ativo = true
          AND COALESCE(p.bloqueado, false) = false
        ORDER BY dv.ordem, dv.leads_hoje, dv.ultima_atribuicao NULLS FIRST
    LOOP
        -- Determinar limite (0 = usa padrão)
        limite_atual := CASE 
            WHEN vendedor_record.limite_diario > 0 THEN vendedor_record.limite_diario
            ELSE config_record.limite_diario_padrao
        END;
        
        -- Verificar se está abaixo do limite
        IF vendedor_record.leads_hoje < limite_atual THEN
            RETURN vendedor_record.vendedor_id;
        END IF;
    END LOOP;
    
    -- Se ninguém disponível, usar fallback
    RETURN config_record.fallback_usuario_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FASE 5: FUNÇÃO - ATRIBUIR LEAD AUTOMATICAMENTE
-- ============================================

CREATE OR REPLACE FUNCTION atribuir_lead_automaticamente(p_lead_id UUID)
RETURNS UUID AS $$
DECLARE
    v_vendedor_id UUID;
    v_motivo VARCHAR(50);
    v_fallback_id UUID;
BEGIN
    -- Buscar próximo vendedor
    v_vendedor_id := get_proximo_vendedor_distribuicao();
    
    IF v_vendedor_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Verificar se é fallback
    SELECT fallback_usuario_id INTO v_fallback_id FROM distribuicao_config LIMIT 1;
    
    IF v_vendedor_id = v_fallback_id THEN
        v_motivo := 'fallback';
    ELSE
        v_motivo := 'round_robin';
    END IF;
    
    -- Atualizar lead
    UPDATE leads 
    SET vendedor_id = v_vendedor_id, 
        updated_at = NOW()
    WHERE id = p_lead_id;
    
    -- Atualizar contador do vendedor
    UPDATE distribuicao_vendedores
    SET leads_hoje = leads_hoje + 1,
        total_leads = total_leads + 1,
        ultima_atribuicao = NOW(),
        updated_at = NOW()
    WHERE vendedor_id = v_vendedor_id;
    
    -- Registrar histórico
    INSERT INTO distribuicao_historico (lead_id, vendedor_id, atribuido_automaticamente, motivo)
    VALUES (p_lead_id, v_vendedor_id, true, v_motivo);
    
    RETURN v_vendedor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FASE 6: FUNÇÃO - RESETAR CONTADORES DIÁRIOS
-- ============================================

CREATE OR REPLACE FUNCTION resetar_contadores_distribuicao()
RETURNS void AS $$
BEGIN
    UPDATE distribuicao_vendedores
    SET leads_hoje = 0,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FASE 7: TRIGGER - AUTO-DISTRIBUIR NOVOS LEADS
-- ============================================

CREATE OR REPLACE FUNCTION trigger_distribuir_lead()
RETURNS TRIGGER AS $$
DECLARE
    v_vendedor_id UUID;
BEGIN
    -- Só distribuir se não tiver vendedor e etapa for 'novo'
    IF NEW.vendedor_id IS NULL AND NEW.etapa = 'novo' THEN
        v_vendedor_id := get_proximo_vendedor_distribuicao();
        
        IF v_vendedor_id IS NOT NULL THEN
            NEW.vendedor_id := v_vendedor_id;
            
            -- Atualizar contador
            UPDATE distribuicao_vendedores
            SET leads_hoje = leads_hoje + 1,
                total_leads = total_leads + 1,
                ultima_atribuicao = NOW(),
                updated_at = NOW()
            WHERE vendedor_id = v_vendedor_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_auto_distribuir_lead
    BEFORE INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_distribuir_lead();

-- ============================================
-- FASE 8: TRIGGER - REGISTRAR HISTÓRICO
-- ============================================

CREATE OR REPLACE FUNCTION trigger_registrar_historico_distribuicao()
RETURNS TRIGGER AS $$
DECLARE
    v_fallback_id UUID;
    v_motivo VARCHAR(50);
BEGIN
    -- Só registrar se vendedor foi atribuído
    IF NEW.vendedor_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.vendedor_id IS DISTINCT FROM NEW.vendedor_id) THEN
        -- Verificar se é fallback
        SELECT fallback_usuario_id INTO v_fallback_id FROM distribuicao_config LIMIT 1;
        
        IF NEW.vendedor_id = v_fallback_id THEN
            v_motivo := 'fallback';
        ELSE
            v_motivo := 'round_robin';
        END IF;
        
        -- Evitar duplicatas
        INSERT INTO distribuicao_historico (lead_id, vendedor_id, atribuido_automaticamente, motivo)
        SELECT NEW.id, NEW.vendedor_id, true, v_motivo
        WHERE NOT EXISTS (
            SELECT 1 FROM distribuicao_historico 
            WHERE lead_id = NEW.id 
            AND vendedor_id = NEW.vendedor_id
            AND created_at > NOW() - INTERVAL '1 minute'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_historico_distribuicao
    AFTER INSERT OR UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_registrar_historico_distribuicao();

-- ============================================
-- FASE 9: RLS POLICIES
-- ============================================

ALTER TABLE distribuicao_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribuicao_vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribuicao_historico ENABLE ROW LEVEL SECURITY;

-- Políticas para funcionários
CREATE POLICY "Funcionarios podem ver config" ON distribuicao_config
    FOR SELECT USING (am_i_funcionario());

CREATE POLICY "Gerencia pode atualizar config" ON distribuicao_config
    FOR UPDATE USING (am_i_gerencia());

CREATE POLICY "Funcionarios podem ver vendedores" ON distribuicao_vendedores
    FOR SELECT USING (am_i_funcionario());

CREATE POLICY "Gerencia pode gerenciar vendedores" ON distribuicao_vendedores
    FOR ALL USING (am_i_gerencia());

CREATE POLICY "Funcionarios podem ver historico" ON distribuicao_historico
    FOR SELECT USING (am_i_funcionario());

CREATE POLICY "Sistema pode inserir historico" ON distribuicao_historico
    FOR INSERT WITH CHECK (true);
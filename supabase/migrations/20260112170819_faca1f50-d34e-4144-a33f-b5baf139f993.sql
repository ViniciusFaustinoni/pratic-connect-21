-- ========================================
-- FASE 1: ATUALIZAR ESTRUTURA DO BANCO
-- ========================================

-- 1.1 Adicionar campos de contrato na tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contrato_id VARCHAR(100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contrato_status VARCHAR(30);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contrato_enviado_em TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contrato_assinado_em TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS planos_interesse TEXT[];

-- Constraint para contrato_status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_contrato_status_check'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_contrato_status_check 
      CHECK (contrato_status IS NULL OR contrato_status IN ('pendente', 'enviado', 'visualizado', 'assinado', 'recusado', 'expirado'));
  END IF;
END $$;

-- Índice para status do contrato
CREATE INDEX IF NOT EXISTS idx_leads_contrato_status ON leads(contrato_status);

-- 1.2 Expandir tabela leads_historico
ALTER TABLE leads_historico ADD COLUMN IF NOT EXISTS dados_extras JSONB;
ALTER TABLE leads_historico ADD COLUMN IF NOT EXISTS usuario_nome VARCHAR(255);

-- 1.3 Criar tabela notificacoes_vendas
CREATE TABLE IF NOT EXISTS notificacoes_vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
        'novo_lead',
        'lead_atribuido',
        'contrato_assinado',
        'contrato_recusado',
        'lead_perdido',
        'lembrete_followup',
        'meta_atingida',
        'cotacao_enviada'
    )),
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    dados_extras JSONB,
    lida BOOLEAN DEFAULT false,
    lida_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para notificacoes_vendas
CREATE INDEX IF NOT EXISTS idx_notif_vendas_usuario ON notificacoes_vendas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_vendas_lida ON notificacoes_vendas(lida);
CREATE INDEX IF NOT EXISTS idx_notif_vendas_created ON notificacoes_vendas(created_at DESC);

-- RLS para notificacoes_vendas
ALTER TABLE notificacoes_vendas ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem suas próprias notificações
DROP POLICY IF EXISTS "notif_vendas_select_proprio" ON notificacoes_vendas;
CREATE POLICY "notif_vendas_select_proprio" ON notificacoes_vendas FOR SELECT
USING (usuario_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Policy: usuários podem atualizar suas próprias notificações (marcar como lida)
DROP POLICY IF EXISTS "notif_vendas_update_proprio" ON notificacoes_vendas;
CREATE POLICY "notif_vendas_update_proprio" ON notificacoes_vendas FOR UPDATE
USING (usuario_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Policy: sistema pode inserir notificações
DROP POLICY IF EXISTS "notif_vendas_insert" ON notificacoes_vendas;
CREATE POLICY "notif_vendas_insert" ON notificacoes_vendas FOR INSERT
WITH CHECK (true);

-- 1.4 Trigger: Notificar contrato assinado
CREATE OR REPLACE FUNCTION fn_notificar_contrato_assinado_vendas()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    -- Só notifica se contrato foi assinado e tem vendedor
    IF OLD.contrato_status IS DISTINCT FROM NEW.contrato_status 
       AND NEW.contrato_status = 'assinado' 
       AND NEW.vendedor_id IS NOT NULL THEN
        
        -- Buscar profile_id do vendedor
        SELECT id INTO v_profile_id FROM profiles WHERE user_id = NEW.vendedor_id;
        
        IF v_profile_id IS NOT NULL THEN
            INSERT INTO notificacoes_vendas (usuario_id, tipo, titulo, mensagem, lead_id, dados_extras)
            VALUES (
                v_profile_id,
                'contrato_assinado',
                '🎉 Contrato Assinado!',
                'O lead ' || NEW.nome || ' assinou o contrato.',
                NEW.id,
                jsonb_build_object('plano_id', NEW.plano_id, 'nome_cliente', NEW.nome)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_notif_contrato_assinado ON leads;
CREATE TRIGGER trigger_notif_contrato_assinado
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION fn_notificar_contrato_assinado_vendas();

-- 1.5 Trigger: Notificar lead atribuído
CREATE OR REPLACE FUNCTION fn_notificar_lead_atribuido_vendas()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    -- Só notifica se vendedor foi atribuído (novo ou alterado)
    IF OLD.vendedor_id IS DISTINCT FROM NEW.vendedor_id 
       AND NEW.vendedor_id IS NOT NULL THEN
        
        -- Buscar profile_id do vendedor
        SELECT id INTO v_profile_id FROM profiles WHERE user_id = NEW.vendedor_id;
        
        IF v_profile_id IS NOT NULL THEN
            INSERT INTO notificacoes_vendas (usuario_id, tipo, titulo, mensagem, lead_id, dados_extras)
            VALUES (
                v_profile_id,
                'lead_atribuido',
                '📥 Novo Lead Recebido',
                'Você recebeu o lead ' || NEW.nome || '. Telefone: ' || COALESCE(NEW.telefone, 'N/A'),
                NEW.id,
                jsonb_build_object(
                    'origem', NEW.origem,
                    'veiculo', COALESCE(NEW.veiculo_marca, '') || ' ' || COALESCE(NEW.veiculo_modelo, '')
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_notif_lead_atribuido ON leads;
CREATE TRIGGER trigger_notif_lead_atribuido
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION fn_notificar_lead_atribuido_vendas();

-- 1.6 Trigger: Registrar histórico expandido
CREATE OR REPLACE FUNCTION fn_registrar_historico_lead_expandido()
RETURNS TRIGGER AS $$
DECLARE
    v_usuario_id UUID;
    v_usuario_nome VARCHAR(255);
BEGIN
    -- Buscar usuário atual
    SELECT id, nome INTO v_usuario_id, v_usuario_nome
    FROM profiles WHERE user_id = auth.uid();
    
    -- Se mudou de etapa, registrar
    IF OLD.etapa IS DISTINCT FROM NEW.etapa THEN
        INSERT INTO leads_historico (
            lead_id, tipo, descricao, dados_extras, usuario_id, usuario_nome
        ) VALUES (
            NEW.id,
            'mudanca_etapa',
            'Lead movido de ' || COALESCE(OLD.etapa::text, 'nenhuma') || ' para ' || NEW.etapa::text,
            jsonb_build_object('etapa_anterior', OLD.etapa, 'etapa_nova', NEW.etapa),
            v_usuario_id,
            v_usuario_nome
        );
    END IF;
    
    -- Se contrato foi assinado
    IF OLD.contrato_status IS DISTINCT FROM NEW.contrato_status 
       AND NEW.contrato_status = 'assinado' THEN
        INSERT INTO leads_historico (
            lead_id, tipo, descricao, dados_extras, usuario_id, usuario_nome
        ) VALUES (
            NEW.id,
            'contrato_assinado',
            'Contrato assinado pelo cliente',
            jsonb_build_object('contrato_id', NEW.contrato_id),
            v_usuario_id,
            v_usuario_nome
        );
    END IF;
    
    -- Se foi perdido
    IF OLD.etapa IS DISTINCT FROM NEW.etapa AND NEW.etapa = 'perdido' THEN
        INSERT INTO leads_historico (
            lead_id, tipo, descricao, dados_extras, usuario_id, usuario_nome
        ) VALUES (
            NEW.id,
            'perda',
            'Lead marcado como perdido: ' || COALESCE(NEW.motivo_perda, 'Sem motivo'),
            jsonb_build_object('motivo', NEW.motivo_perda, 'etapa_anterior', OLD.etapa),
            v_usuario_id,
            v_usuario_nome
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_historico_lead_expandido ON leads;
CREATE TRIGGER trigger_historico_lead_expandido
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_historico_lead_expandido();
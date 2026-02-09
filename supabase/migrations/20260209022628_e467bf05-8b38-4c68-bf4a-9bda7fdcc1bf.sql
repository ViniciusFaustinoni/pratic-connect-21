-- =====================================================
-- MIGRAÇÃO: Preparação do Banco para Fluxo de Retirada
-- =====================================================

-- 1. Adicionar novo status ao enum status_rastreador
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'retirada_pendente';

-- 2. Adicionar colunas específicas para retirada na tabela servicos
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS motivo_retirada VARCHAR(50) DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS sub_tipo_retirada VARCHAR(30) DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS tem_debitos_pendentes BOOLEAN DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS debitos_conferidos_por UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS debitos_conferidos_em TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS multa_aplicada BOOLEAN DEFAULT false;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS multa_valor DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS multa_motivo VARCHAR(100) DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS multa_cobrada_em TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS multa_forma_cobranca VARCHAR(20) DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS multa_asaas_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS localizacao_rastreador JSONB DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS checklist_retirada JSONB DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS integridade_aparelho VARCHAR(30) DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS chip_presente BOOLEAN DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS fios_isolados BOOLEAN DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS acabamento_recolocado BOOLEAN DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS retirada_video_360_url VARCHAR(500) DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS assinatura_devolucao_url VARCHAR(500) DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS plataforma_desativada BOOLEAN DEFAULT false;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS chip_cancelado BOOLEAN DEFAULT false;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS solicitado_por_modulo VARCHAR(30) DEFAULT NULL;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS cancelamento_bloqueado_ate_devolucao BOOLEAN DEFAULT false;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS novo_veiculo_id UUID REFERENCES veiculos(id) DEFAULT NULL;

-- 3. Comentários explicativos para documentação
COMMENT ON COLUMN servicos.motivo_retirada IS 'cancelamento_voluntario, inadimplencia, exclusao_diretoria, substituicao_veiculo, busca_apreensao';
COMMENT ON COLUMN servicos.sub_tipo_retirada IS 'somente_retirada, retirada_com_nova_instalacao';
COMMENT ON COLUMN servicos.multa_forma_cobranca IS 'automatica_asaas para integração com cobrança, manual_financeiro para conferência posterior';
COMMENT ON COLUMN servicos.integridade_aparelho IS 'integro, danificado, violado, molhado';
COMMENT ON COLUMN servicos.solicitado_por_modulo IS 'cadastro, monitoramento, financeiro, diretoria';
COMMENT ON COLUMN servicos.novo_veiculo_id IS 'Quando sub_tipo = retirada_com_nova_instalacao, vincula ao novo veículo';
COMMENT ON COLUMN servicos.retirada_video_360_url IS 'Vídeo 360 específico da retirada (separado do video_360_url de instalação/manutenção)';
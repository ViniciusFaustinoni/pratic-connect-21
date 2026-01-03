-- =====================================================
-- MIGRAÇÃO: Atualizar chamados_assistencia conforme PRD
-- =====================================================

-- 1. Adicionar novos valores ao enum status_chamado
ALTER TYPE status_chamado ADD VALUE IF NOT EXISTS 'aguardando_prestador';
ALTER TYPE status_chamado ADD VALUE IF NOT EXISTS 'prestador_despachado';
ALTER TYPE status_chamado ADD VALUE IF NOT EXISTS 'prestador_a_caminho';
ALTER TYPE status_chamado ADD VALUE IF NOT EXISTS 'em_atendimento';
ALTER TYPE status_chamado ADD VALUE IF NOT EXISTS 'cancelado_associado';
ALTER TYPE status_chamado ADD VALUE IF NOT EXISTS 'cancelado_sistema';

-- 2. Adicionar campo avaliacao_comentario
ALTER TABLE chamados_assistencia 
ADD COLUMN IF NOT EXISTS avaliacao_comentario TEXT;

-- 3. Adicionar campos de endereço consolidados (mantendo os existentes para retrocompatibilidade)
ALTER TABLE chamados_assistencia 
ADD COLUMN IF NOT EXISTS origem_endereco VARCHAR(255),
ADD COLUMN IF NOT EXISTS destino_endereco VARCHAR(255);

-- 4. Adicionar constraint de validação na nota de avaliação
ALTER TABLE chamados_assistencia 
DROP CONSTRAINT IF EXISTS chamados_assistencia_avaliacao_nota_check;

ALTER TABLE chamados_assistencia 
ADD CONSTRAINT chamados_assistencia_avaliacao_nota_check 
CHECK (avaliacao_nota IS NULL OR (avaliacao_nota >= 1 AND avaliacao_nota <= 5));

-- 5. Criar índices para performance (se não existirem)
CREATE INDEX IF NOT EXISTS idx_chamados_associado ON chamados_assistencia(associado_id);
CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados_assistencia(status);
CREATE INDEX IF NOT EXISTS idx_chamados_data_abertura ON chamados_assistencia(data_abertura DESC);
CREATE INDEX IF NOT EXISTS idx_chamados_protocolo ON chamados_assistencia(protocolo);
CREATE INDEX IF NOT EXISTS idx_chamados_veiculo ON chamados_assistencia(veiculo_id);

-- 6. Comentários
COMMENT ON TABLE chamados_assistencia IS 'Chamados de assistência 24h (guincho, chaveiro, pane, etc)';
COMMENT ON COLUMN chamados_assistencia.tipo_servico IS 'reboque, chaveiro, troca_pneu, pane_seca, bateria, outro';
COMMENT ON COLUMN chamados_assistencia.status IS 'Fluxo: aberto → aguardando_prestador → prestador_despachado → prestador_a_caminho → em_atendimento → concluido';
COMMENT ON COLUMN chamados_assistencia.protocolo IS 'Formato: ASS-YYYYMMDD-XXXX';
COMMENT ON COLUMN chamados_assistencia.avaliacao_comentario IS 'Comentário opcional da avaliação do associado';
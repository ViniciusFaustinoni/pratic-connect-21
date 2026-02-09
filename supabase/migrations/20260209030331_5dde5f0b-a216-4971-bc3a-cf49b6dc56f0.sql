-- Adicionar campos de pendência de rastreador na tabela associados
ALTER TABLE associados 
ADD COLUMN IF NOT EXISTS pendencia_rastreador BOOLEAN DEFAULT false;

ALTER TABLE associados 
ADD COLUMN IF NOT EXISTS pendencia_rastreador_servico_id UUID 
REFERENCES servicos(id) ON DELETE SET NULL;

-- Índice para queries rápidas
CREATE INDEX IF NOT EXISTS idx_associados_pendencia_rastreador 
ON associados(pendencia_rastreador) WHERE pendencia_rastreador = true;

-- Comentários para documentação
COMMENT ON COLUMN associados.pendencia_rastreador IS 
'Indica se o associado tem rastreador pendente de devolução (bloqueia finalização de cancelamento)';

COMMENT ON COLUMN associados.pendencia_rastreador_servico_id IS 
'ID do serviço de retirada vinculado à pendência';
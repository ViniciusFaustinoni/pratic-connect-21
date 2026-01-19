-- Estágio 1: Alterações Estruturais para Unificação de Vistorias

-- 1.1 Adicionar colunas de origem e referências na tabela vistorias
ALTER TABLE vistorias
ADD COLUMN IF NOT EXISTS origem TEXT,
ADD COLUMN IF NOT EXISTS cotacao_id UUID REFERENCES cotacoes(id),
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);

-- 1.2 Permitir associado_id nulo (cotações podem não ter associado ainda)
ALTER TABLE vistorias ALTER COLUMN associado_id DROP NOT NULL;

-- 1.3 Adicionar vistoria_id nas tabelas de origem
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS vistoria_id UUID REFERENCES vistorias(id);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS vistoria_id UUID REFERENCES vistorias(id);

-- 1.4 Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_vistorias_origem ON vistorias(origem);
CREATE INDEX IF NOT EXISTS idx_vistorias_cotacao_id ON vistorias(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_lead_id ON vistorias(lead_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_rota_id ON vistorias(rota_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_vistoria_id ON cotacoes(vistoria_id);
CREATE INDEX IF NOT EXISTS idx_contratos_vistoria_id ON contratos(vistoria_id);

-- 1.5 Comentários para documentação
COMMENT ON COLUMN vistorias.origem IS 'Origem da vistoria: cotacao, contrato, sinistro, manutencao';
COMMENT ON COLUMN vistorias.cotacao_id IS 'Referência à cotação quando origem=cotacao';
COMMENT ON COLUMN vistorias.lead_id IS 'Referência ao lead quando vindo de cotação';
COMMENT ON COLUMN cotacoes.vistoria_id IS 'Referência à vistoria unificada';
COMMENT ON COLUMN contratos.vistoria_id IS 'Referência à vistoria unificada';
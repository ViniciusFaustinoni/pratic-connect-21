-- Adicionar campos faltantes na tabela instalacoes para persistir checklist e quilometragem

-- Campo para armazenar checklist em JSON
ALTER TABLE instalacoes 
ADD COLUMN IF NOT EXISTS checklist_data JSONB DEFAULT '{}';

-- Campo para quilometragem do veículo
ALTER TABLE instalacoes 
ADD COLUMN IF NOT EXISTS quilometragem INTEGER;

-- Campo para hora agendada (se não existir)
ALTER TABLE instalacoes 
ADD COLUMN IF NOT EXISTS hora_agendada TIME;

-- Campos de timestamps para início e conclusão
ALTER TABLE instalacoes 
ADD COLUMN IF NOT EXISTS iniciada_em TIMESTAMPTZ;

ALTER TABLE instalacoes 
ADD COLUMN IF NOT EXISTS concluida_em TIMESTAMPTZ;

-- Campo para vincular ao lead (opcional, para rastreabilidade)
ALTER TABLE instalacoes 
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);

-- Índice para buscas por lead
CREATE INDEX IF NOT EXISTS idx_instalacoes_lead_id ON instalacoes(lead_id);

-- Comentários para documentação
COMMENT ON COLUMN instalacoes.checklist_data IS 'Dados do checklist de instalação em formato JSON';
COMMENT ON COLUMN instalacoes.quilometragem IS 'Quilometragem do veículo no momento da instalação';
COMMENT ON COLUMN instalacoes.iniciada_em IS 'Data/hora que a instalação foi iniciada';
COMMENT ON COLUMN instalacoes.concluida_em IS 'Data/hora que a instalação foi concluída';
COMMENT ON COLUMN instalacoes.lead_id IS 'Referência opcional ao lead de origem';
-- Adicionar colunas de controle de peças no sinistro
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS pecas_pedido_realizado boolean DEFAULT false;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS pecas_status jsonb DEFAULT '[]';

-- Adicionar sinistro_id no chamados_assistencia para vincular chamado de guincho ao sinistro
ALTER TABLE chamados_assistencia ADD COLUMN IF NOT EXISTS sinistro_id uuid REFERENCES sinistros(id);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_chamados_assistencia_sinistro_id ON chamados_assistencia(sinistro_id) WHERE sinistro_id IS NOT NULL;
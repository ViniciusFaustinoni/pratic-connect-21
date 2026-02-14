-- Add aguardando_entrada status to enum
ALTER TYPE status_ordem_servico ADD VALUE IF NOT EXISTS 'aguardando_entrada' BEFORE 'aguardando_orcamento';

-- Add tracking columns to ordens_servico
ALTER TABLE ordens_servico
  ADD COLUMN IF NOT EXISTS auto_center_id uuid REFERENCES auto_centers(id),
  ADD COLUMN IF NOT EXISTS cotacao_aprovada_id uuid REFERENCES evento_cotacoes_pecas(id),
  ADD COLUMN IF NOT EXISTS etapas_reparo jsonb DEFAULT '[]';
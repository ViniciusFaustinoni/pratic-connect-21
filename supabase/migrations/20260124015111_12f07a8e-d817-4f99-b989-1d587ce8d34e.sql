-- Adicionar campos para armazenar motivo do cancelamento na cotação
ALTER TABLE cotacoes 
ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT,
ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ;

-- Comentários para documentação
COMMENT ON COLUMN cotacoes.motivo_cancelamento IS 'Motivo do cancelamento da cotação (ex: falta de pagamento)';
COMMENT ON COLUMN cotacoes.cancelada_em IS 'Data/hora em que a cotação foi cancelada';
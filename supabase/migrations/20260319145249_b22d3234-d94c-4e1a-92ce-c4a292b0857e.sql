
-- Make cotacao_id nullable for direct entry migrations
ALTER TABLE solicitacoes_migracao ALTER COLUMN cotacao_id DROP NOT NULL;

-- Add origin tracking column
ALTER TABLE solicitacoes_migracao ADD COLUMN IF NOT EXISTS origem_entrada text NOT NULL DEFAULT 'consultor';

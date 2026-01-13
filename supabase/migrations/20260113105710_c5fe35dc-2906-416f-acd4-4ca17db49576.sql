-- Tornar plano_id nullable na tabela cotacoes
-- Isso permite salvar cotações com planos calculados dinamicamente (que não são UUIDs do banco)

ALTER TABLE cotacoes ALTER COLUMN plano_id DROP NOT NULL;
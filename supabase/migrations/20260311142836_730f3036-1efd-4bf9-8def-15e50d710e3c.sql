-- Drop legacy pricing tables (no longer referenced by code or FK constraints)
-- tabelas_preco had 12 inactive records (all ativo=false), migrated to tabelas_preco_mensalidade
DROP TABLE IF EXISTS tabelas_preco_historico;
DROP TABLE IF EXISTS tabelas_preco_adesao;
DROP TABLE IF EXISTS tabelas_preco;
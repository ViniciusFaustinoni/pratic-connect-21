ALTER TABLE tabelas_preco_mensalidade
  ALTER COLUMN categoria DROP NOT NULL,
  ALTER COLUMN tipo_uso DROP NOT NULL;
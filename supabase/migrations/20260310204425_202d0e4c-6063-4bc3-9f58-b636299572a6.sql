ALTER TABLE tabelas_preco_mensalidade
ADD COLUMN IF NOT EXISTS requer_autorizacao boolean DEFAULT false;
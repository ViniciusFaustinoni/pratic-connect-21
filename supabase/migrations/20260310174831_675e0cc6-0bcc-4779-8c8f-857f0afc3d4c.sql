UPDATE tabelas_preco
SET ativo = false
WHERE plano_id IN (
  SELECT id FROM planos WHERE ativo = false
);
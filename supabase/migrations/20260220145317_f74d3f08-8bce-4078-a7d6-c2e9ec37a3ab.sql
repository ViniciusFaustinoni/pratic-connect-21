
-- Remover constraint antigo com nome diferente na tabela contratos
ALTER TABLE contratos 
DROP CONSTRAINT IF EXISTS check_dia_vencimento;

-- Também remover qualquer outro constraint com nome alternativo na tabela associados
ALTER TABLE associados
DROP CONSTRAINT IF EXISTS check_dia_vencimento;

-- Recarregar schema do PostgREST para reconhecer as mudanças
NOTIFY pgrst, 'reload schema';

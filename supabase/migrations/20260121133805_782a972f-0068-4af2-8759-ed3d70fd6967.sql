-- Adicionar coluna para dia de vencimento na cotação
ALTER TABLE cotacoes 
ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER;

-- Adicionar constraint para validar valores permitidos
ALTER TABLE cotacoes 
ADD CONSTRAINT check_dia_vencimento 
CHECK (dia_vencimento IN (5, 10, 15, 20, 25, 30) OR dia_vencimento IS NULL);

-- Comentário para documentação
COMMENT ON COLUMN cotacoes.dia_vencimento IS 'Dia do mês para vencimento das parcelas (5, 10, 15, 20, 25 ou 30)';
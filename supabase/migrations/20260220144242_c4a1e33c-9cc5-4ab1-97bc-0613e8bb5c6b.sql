
-- Ampliar constraint dia_vencimento na tabela associados (de <= 28 para <= 31)
ALTER TABLE associados 
DROP CONSTRAINT IF EXISTS associados_dia_vencimento_check;

ALTER TABLE associados 
ADD CONSTRAINT associados_dia_vencimento_check 
CHECK (dia_vencimento IS NULL OR (dia_vencimento >= 1 AND dia_vencimento <= 31));

-- Verificar e corrigir mesmo constraint na tabela contratos, se existir
ALTER TABLE contratos 
DROP CONSTRAINT IF EXISTS contratos_dia_vencimento_check;

ALTER TABLE contratos 
ADD CONSTRAINT contratos_dia_vencimento_check 
CHECK (dia_vencimento IS NULL OR (dia_vencimento >= 1 AND dia_vencimento <= 31));

-- Desativar plano ELÉTRICOS órfão (sem product_line_id, sem benefícios)
-- Este plano não aparece na UI de vendas e está causando inconsistência
UPDATE planos 
SET ativo = false 
WHERE codigo = 'eletricos' 
  AND product_line_id IS NULL;
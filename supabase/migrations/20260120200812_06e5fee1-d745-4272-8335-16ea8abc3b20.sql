-- Copiar veiculo_cor das cotações para contratos existentes
UPDATE contratos c
SET veiculo_cor = cot.veiculo_cor
FROM cotacoes cot
WHERE c.cotacao_id = cot.id
  AND c.veiculo_cor IS NULL
  AND cot.veiculo_cor IS NOT NULL;
-- Atualizar veículos existentes: copiar cor do contrato
UPDATE veiculos v
SET cor = c.veiculo_cor
FROM contratos c
WHERE v.associado_id = c.associado_id
  AND v.placa = c.veiculo_placa
  AND v.cor IS NULL
  AND c.veiculo_cor IS NOT NULL;
-- Corrigir cobertura do veículo do Marcus Vinicius (ID correto)
UPDATE veiculos 
SET cobertura_total = true, 
    status = 'ativo'
WHERE id = '9dba80a3-a344-4290-9643-b00689d01d7d';
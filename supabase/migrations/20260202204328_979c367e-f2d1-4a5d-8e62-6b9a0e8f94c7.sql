-- Corrigir dados do veículo do Marcus Vinicius (instalação concluída mas cobertura_total não ativada)
UPDATE veiculos 
SET cobertura_total = true, 
    status = 'ativo'
WHERE id = '05a11b11-3eb0-48a3-9d7c-120d68f035e9';
-- Corrigir dados do Marcus Vinicius para continuar sincronização SGA
-- Associado já existe no SGA Hinova com código 28779

-- Atualizar associado com código já existente no SGA
UPDATE associados 
SET codigo_hinova = 28779,
    sincronizado_hinova = true,
    sincronizado_hinova_em = NOW()
WHERE id = '3bab27b4-24de-48cd-8d75-758629509825';

-- Resetar status do veículo para tentar novamente a sincronização
UPDATE veiculos 
SET status_sga = 'pendente'
WHERE id = '9dba80a3-a344-4290-9643-b00689d01d7d';
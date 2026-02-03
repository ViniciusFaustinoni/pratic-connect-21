
-- Corrigir veículo afetado pelo bug (instalação concluída mas cobertura_total = false)
UPDATE veiculos 
SET cobertura_total = true, status = 'ativo'
WHERE id = 'a15a1745-bc59-4f18-9f0e-53ecdf966c9c';

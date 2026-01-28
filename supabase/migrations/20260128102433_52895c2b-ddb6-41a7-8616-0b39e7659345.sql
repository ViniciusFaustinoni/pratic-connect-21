-- Corrigir dados do MARCUS VINICIUS
-- 1. Restaurar status do associado para ativo
UPDATE associados
SET status = 'ativo',
    updated_at = NOW()
WHERE id = '9487e709-2154-4f44-b9bc-eb7a423cf98b';

-- 2. Ativar cobertura total do veículo (já tem rastreador instalado)
UPDATE veiculos
SET cobertura_total = true,
    updated_at = NOW()
WHERE id = 'e455066e-3b22-4d68-9e56-4ca9ffce4d93';
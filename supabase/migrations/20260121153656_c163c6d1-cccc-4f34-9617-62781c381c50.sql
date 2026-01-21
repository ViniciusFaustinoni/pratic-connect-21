-- Resetar status para permitir nova análise do analista de cadastro
-- O analista vê propostas com instalação concluída e contrato pendente

-- 1. Voltar contrato para pendente
UPDATE contratos 
SET status = 'pendente'
WHERE associado_id = (SELECT id FROM associados WHERE nome ILIKE '%MARCUS VINICIUS%' LIMIT 1);

-- 2. Voltar associado para documentacao_pendente (status antes da aprovação)
UPDATE associados 
SET status = 'documentacao_pendente',
    aprovado_por = NULL,
    aprovado_em = NULL
WHERE nome ILIKE '%MARCUS VINICIUS%';

-- 3. Garantir que instalação está concluída (para aparecer na fila do analista)
UPDATE instalacoes 
SET status = 'concluida'
WHERE associado_id = (SELECT id FROM associados WHERE nome ILIKE '%MARCUS VINICIUS%' LIMIT 1)
AND status != 'cancelada';

-- 4. Voltar veículo para status em_analise (status válido do enum)
UPDATE veiculos 
SET status = 'em_analise',
    cobertura_roubo_furto = false,
    cobertura_total = false
WHERE associado_id = (SELECT id FROM associados WHERE nome ILIKE '%MARCUS VINICIUS%' LIMIT 1);
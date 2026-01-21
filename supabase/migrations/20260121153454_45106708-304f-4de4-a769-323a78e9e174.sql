-- Corrigir status do associado para teste (após vistoria de instalação concluída)
UPDATE associados 
SET status = 'em_analise' 
WHERE nome ILIKE '%MARCUS VINICIUS%';

-- Remover instalação duplicada criada erroneamente (manter apenas a concluída)
DELETE FROM instalacoes 
WHERE associado_id = (SELECT id FROM associados WHERE nome ILIKE '%MARCUS VINICIUS%' LIMIT 1)
AND status = 'agendada';

-- Corrigir status do veículo para em_analise
UPDATE veiculos 
SET status = 'em_analise' 
WHERE associado_id = (SELECT id FROM associados WHERE nome ILIKE '%MARCUS VINICIUS%' LIMIT 1);
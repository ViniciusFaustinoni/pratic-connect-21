-- Remover instalação duplicada (criada manualmente sem cotacao_id)
DELETE FROM instalacoes 
WHERE id = '7fce7551-b637-4733-aafb-dc365cc5611e';

-- Criar constraint única parcial para evitar múltiplas instalações ativas por veículo
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_instalacao_ativa_por_veiculo
ON instalacoes (veiculo_id)
WHERE status IN ('agendada', 'em_rota', 'em_andamento');
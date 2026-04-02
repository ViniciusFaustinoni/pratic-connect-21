-- Restaurar serviço afetado
UPDATE servicos 
SET status = 'agendada', 
    reagendamento_enviado_em = NULL,
    updated_at = NOW()
WHERE id = 'b232b3ca-6eb1-466c-bff3-ef385bb44a26'
  AND status = 'nao_compareceu';

-- Restaurar instalação vinculada
UPDATE instalacoes
SET status = 'agendada',
    updated_at = NOW()
WHERE id = 'ba5aecdd-b3dd-495a-a1f7-cf470db5df0a'
  AND status = 'nao_compareceu';
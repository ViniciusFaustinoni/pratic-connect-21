
-- 1. Deletar servico cancelado órfão (criado pelo trigger sync_instalacao_to_servicos)
DELETE FROM servicos WHERE id = '521a7acf-e54f-4380-8b7c-8bcc6d0b65d1';

-- 2. Vincular o servico bom à instalação
UPDATE servicos
   SET instalacao_origem_id = '3195ba53-a18f-42e3-8693-7bdad9d85fe3'
 WHERE id = '23e6bad5-2ae3-465d-b699-ed4860388346';

-- 3. Restaurar a instalação para 'agendada'
UPDATE instalacoes
   SET status = 'agendada'::status_instalacao,
       observacoes = NULL,
       updated_at = now()
 WHERE id = '3195ba53-a18f-42e3-8693-7bdad9d85fe3';

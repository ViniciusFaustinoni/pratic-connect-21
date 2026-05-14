UPDATE servicos
   SET vistoria_origem_id = 'ee76355d-2b71-4bc4-bdac-a8b133d7dc8c'
 WHERE id = '622f57ee-669c-437d-8354-82000757ef9a'
   AND vistoria_origem_id IS NULL;

UPDATE associados
   SET status = 'aguardando_aprovacao_monitoramento'
 WHERE id = '2e8c514d-d835-4e4d-8db0-b375438a0985'
   AND status = 'aguardando_instalacao';
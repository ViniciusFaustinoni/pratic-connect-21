-- Correção retroativa: Atualizar status do cliente MARCUS para ativo
UPDATE associados 
SET 
  status = 'ativo',
  data_ativacao = NOW(),
  updated_at = NOW()
WHERE id = '03dd7fe8-c6ed-49cb-8354-99a7dff90b8e';

-- Liberar cobertura total do veículo
UPDATE veiculos 
SET 
  cobertura_total = true,
  updated_at = NOW()
WHERE id = 'cd552a79-8143-47d4-b576-09a999806281';
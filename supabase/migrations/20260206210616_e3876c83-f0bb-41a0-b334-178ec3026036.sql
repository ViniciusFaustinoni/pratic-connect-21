-- Atualizar capacidade diária dos vistoriadores/instaladores para 10 (10 vagas por período = 5 manhã + 5 tarde)
UPDATE profiles
SET capacidade_diaria = 10
WHERE id IN (
  SELECT ur.user_id 
  FROM user_roles ur 
  WHERE ur.role IN ('instalador_vistoriador', 'vistoriador_base')
)
AND (capacidade_diaria IS NULL OR capacidade_diaria = 5);
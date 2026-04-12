-- Atualizar carências nas coberturas duplicadas antigas
UPDATE coberturas
SET carencia_ativa = true, carencia_dias = 120, carencia_tipo = 'liberacao', carencia_multiplicador = 1
WHERE (carencia_ativa = false OR carencia_ativa IS NULL)
AND (nome LIKE '100% FIPE%' OR nome LIKE '75% FIPE%' OR nome LIKE 'Alagamento%' 
     OR nome LIKE 'Chuva de Granizo%' OR nome LIKE 'Colisão%' OR nome LIKE 'Furto%'
     OR nome LIKE 'Incêndio%' OR nome LIKE 'Perda Total%' OR nome LIKE 'Roubo%'
     OR nome LIKE 'Taxa Administrativa%');

-- Atualizar carências nos benefícios duplicados antigos
UPDATE benefits
SET carencia_ativa = true, carencia_dias = 120, carencia_tipo = 'liberacao', carencia_multiplicador = 1
WHERE (carencia_ativa = false OR carencia_ativa IS NULL)
AND name LIKE 'Vidros e Faróis%';
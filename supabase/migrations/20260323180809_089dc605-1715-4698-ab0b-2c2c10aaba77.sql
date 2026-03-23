
UPDATE instalacoes i
SET tipo_deslocamento = CASE
  WHEN m.tipo_atendimento = 'viagem' THEN 'viagem'
  WHEN m.tipo_atendimento = 'prestador' THEN 'prestador'
  ELSE 'volante'
END
FROM associados a
LEFT JOIN municipios_atendimento m
  ON LOWER(TRIM(m.nome)) = LOWER(TRIM(a.cidade))
  AND LOWER(TRIM(m.uf)) = LOWER(TRIM(a.uf))
WHERE i.associado_id = a.id
  AND (i.tipo_deslocamento IS NULL OR i.tipo_deslocamento = '');

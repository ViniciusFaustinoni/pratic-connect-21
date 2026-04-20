-- Adicionar K2500 na Linha Select Diesel + normalizar marca BONGO de "KIA MOTORS" para "KIA"
-- Aplicado APENAS na regra da Linha Select principal (entity_id = 66f8d697-83b9-455e-8d81-ed7bec202105)

UPDATE entity_eligibility_rules
SET rule_config = jsonb_set(
  rule_config,
  '{modelos}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN (m->>'marca') = 'KIA MOTORS' AND upper(m->>'modelo') = 'BONGO'
          THEN jsonb_set(m, '{marca}', '"KIA"'::jsonb)
        ELSE m
      END
    )
    FROM jsonb_array_elements(rule_config->'modelos') AS m
  )
) || jsonb_build_object(
  'modelos',
  (
    SELECT jsonb_agg(
      CASE
        WHEN (m->>'marca') = 'KIA MOTORS' AND upper(m->>'modelo') = 'BONGO'
          THEN jsonb_set(m, '{marca}', '"KIA"'::jsonb)
        ELSE m
      END
    )
    FROM jsonb_array_elements(rule_config->'modelos') AS m
  ) || jsonb_build_array(
    jsonb_build_object(
      'marca', 'KIA',
      'modelo', 'K2500',
      'status', 'aceito',
      'combustivel', 'diesel',
      'categoria', 'veiculo_pesado',
      'ano_min', 2005,
      'ano_max', NULL
    )
  )
)
WHERE id = '2f020a85-e2fe-4293-a8bd-c961accc5d14'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(rule_config->'modelos') AS m
    WHERE upper(m->>'modelo') = 'K2500'
  );
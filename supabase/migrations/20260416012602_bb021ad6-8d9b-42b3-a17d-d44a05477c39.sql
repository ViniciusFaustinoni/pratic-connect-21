
-- Part 1: Copy line-level eligibility rules from original lines to SP and Lagos duplicates
-- Map: original line ID -> [SP line ID, Lagos line ID]
-- SELECT:      66f8d697 -> 732cb639 (SP), a516bb57 (Lagos)
-- LANÇAMENTO:  b46f9ca8 -> 40600e90 (SP), 749177c7 (Lagos)
-- ADVANCED:    c318d079 -> 1897b788 (SP), 05c8b501 (Lagos)
-- ESPECIAL:    16820bb0 -> 45aec5ed (SP), 9021e12a (Lagos)

INSERT INTO entity_eligibility_rules (entity_id, entity_type, rule_type, rule_mode, rule_config, is_active)
SELECT 
  target.target_id,
  r.entity_type,
  r.rule_type,
  r.rule_mode,
  r.rule_config,
  r.is_active
FROM entity_eligibility_rules r
CROSS JOIN (VALUES
  -- SELECT -> SP, Lagos
  ('66f8d697-83b9-455e-8d81-ed7bec202105'::uuid, '732cb639-2d0a-4b9b-b2d4-8559301a49fb'::uuid),
  ('66f8d697-83b9-455e-8d81-ed7bec202105'::uuid, 'a516bb57-0dc6-4102-9a22-31c6dc9bc36b'::uuid),
  -- LANÇAMENTO -> SP, Lagos  
  ('b46f9ca8-2842-4dbb-a21d-9d7293343ec5'::uuid, '40600e90-e6be-4148-a3cb-82dc264d1e2a'::uuid),
  ('b46f9ca8-2842-4dbb-a21d-9d7293343ec5'::uuid, '749177c7-74de-48df-91bf-cf1b35613bf2'::uuid),
  -- ADVANCED -> SP, Lagos
  ('c318d079-8b14-48b3-a8b2-de2897b3b125'::uuid, '1897b788-9345-4dc0-9469-4759e2d7a850'::uuid),
  ('c318d079-8b14-48b3-a8b2-de2897b3b125'::uuid, '05c8b501-75f6-4580-87ca-a9dc858d4dde'::uuid),
  -- ESPECIAL -> SP, Lagos
  ('16820bb0-814a-4fa1-ae02-bf4ad7285e64'::uuid, '45aec5ed-cdfe-48e1-9d2e-9b39e63b9f86'::uuid),
  ('16820bb0-814a-4fa1-ae02-bf4ad7285e64'::uuid, '9021e12a-dc43-4cde-a86a-3af3c9db5674'::uuid)
) AS target(source_id, target_id)
WHERE r.entity_id = target.source_id
  AND r.entity_type = 'linha'
  AND r.rule_type IN ('marca_modelo', 'ano_range')
  -- Avoid duplicates if re-run
  AND NOT EXISTS (
    SELECT 1 FROM entity_eligibility_rules existing
    WHERE existing.entity_id = target.target_id
      AND existing.entity_type = 'linha'
      AND existing.rule_type = r.rule_type
  );

-- Part 2: Normalize tipos_uso -> values for all tipo_uso rules
-- This ensures the engine can read them via cfg.values
UPDATE entity_eligibility_rules
SET rule_config = rule_config || jsonb_build_object('values', rule_config->'tipos_uso')
WHERE rule_type = 'tipo_uso'
  AND rule_config ? 'tipos_uso'
  AND NOT (rule_config ? 'values');

-- Step 1: Convert categoria_especial rules to tipo_placa, remapping config key
UPDATE entity_eligibility_rules
SET 
  rule_type = 'tipo_placa',
  rule_config = CASE
    WHEN rule_config ? 'categorias' AND NOT (rule_config ? 'values')
    THEN jsonb_set(rule_config - 'categorias', '{values}', rule_config->'categorias')
    ELSE rule_config
  END,
  updated_at = now()
WHERE rule_type = 'categoria_especial';

-- Step 2: Deactivate duplicates — if an entity now has multiple tipo_placa rules,
-- keep the most recent one active and deactivate older ones
UPDATE entity_eligibility_rules r
SET is_active = false, updated_at = now()
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY entity_type, entity_id 
    ORDER BY updated_at DESC
  ) as rn
  FROM entity_eligibility_rules
  WHERE rule_type = 'tipo_placa' AND is_active = true
) ranked
WHERE r.id = ranked.id AND ranked.rn > 1;

UPDATE entity_eligibility_rules
SET rule_config = '{"ano_min": 1994, "ano_max": null}'::jsonb
WHERE entity_type = 'linha'
  AND entity_id = '16820bb0-814a-4fa1-ae02-bf4ad7285e64'
  AND rule_type = 'ano_range';

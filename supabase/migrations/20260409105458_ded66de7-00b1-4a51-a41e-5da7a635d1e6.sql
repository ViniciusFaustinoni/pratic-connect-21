
UPDATE entity_eligibility_rules
SET rule_config = '{"values": ["flex", "gasolina", "etanol"]}'::jsonb
WHERE rule_type = 'combustivel'
  AND rule_config::text = '{"values": ["flex", "gasolina"]}';

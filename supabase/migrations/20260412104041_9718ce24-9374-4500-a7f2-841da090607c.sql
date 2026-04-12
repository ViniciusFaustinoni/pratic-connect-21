
UPDATE entity_eligibility_rules
SET rule_config = jsonb_build_object('values', ARRAY['6f99685d-52b6-43e4-9010-dfc03338886a'::text])
WHERE rule_type = 'regiao' 
  AND rule_config ? 'regioes'
  AND rule_config->'regioes' @> '["RJ"]'::jsonb
  AND is_active = true;

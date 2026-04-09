-- Regra de plano: Select One Aplicativo = apenas aplicativo
INSERT INTO entity_eligibility_rules (entity_id, entity_type, rule_type, rule_mode, rule_config, is_active)
VALUES ('d3a61bfd-5b40-4503-949d-cfc71dbfabb2', 'plano', 'tipo_uso', 'include', '{"values":["aplicativo"]}', true);

-- Corrigir coberturas com tipo_uso inconsistente (Granizo e Alagamento)
UPDATE entity_eligibility_rules 
SET rule_config = '{"values":["aplicativo"]}'
WHERE entity_id IN ('b2000001-0000-0000-0000-000000000005', 'b2000001-0000-0000-0000-000000000007')
  AND rule_type = 'tipo_uso';
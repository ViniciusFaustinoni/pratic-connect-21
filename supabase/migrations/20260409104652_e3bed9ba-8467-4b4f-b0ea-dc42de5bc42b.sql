
-- ============================================================
-- 1) Coberturas: flex → flex/gasolina/etanol
-- ============================================================
UPDATE entity_eligibility_rules
SET rule_config = '{"values": ["flex", "gasolina", "etanol"]}'::jsonb
WHERE entity_type = 'cobertura'
  AND rule_type = 'combustivel'
  AND rule_config::text = '{"values": ["flex"]}';

-- ============================================================
-- 2) Benefícios: flex → flex/gasolina/etanol (os que tinham só flex)
-- ============================================================
UPDATE entity_eligibility_rules
SET rule_config = '{"values": ["flex", "gasolina", "etanol"]}'::jsonb
WHERE entity_type = 'beneficio'
  AND rule_type = 'combustivel'
  AND rule_config::text = '{"values": ["flex"]}';

-- ============================================================
-- 3) Benefícios sem regra de combustível em planos não-diesel ativos
--    → adicionar flex/gasolina/etanol
-- ============================================================
INSERT INTO entity_eligibility_rules (entity_type, entity_id, rule_type, rule_config, is_active)
SELECT DISTINCT 'beneficio', pb.benefit_id, 'combustivel',
  '{"values": ["flex", "gasolina", "etanol"]}'::jsonb,
  true
FROM planos p
JOIN planos_beneficios pb ON pb.plano_id = p.id
WHERE p.nome NOT ILIKE '%diesel%'
  AND p.ativo = true
  AND NOT EXISTS(
    SELECT 1 FROM entity_eligibility_rules eer
    WHERE eer.entity_id = pb.benefit_id AND eer.entity_type = 'beneficio' AND eer.rule_type = 'combustivel'
  );

-- ============================================================
-- 4) Select One Aplicativo: tipo_uso ["particular"] → ["aplicativo"]
-- ============================================================
UPDATE entity_eligibility_rules eer
SET rule_config = '{"values": ["aplicativo"]}'::jsonb
FROM planos_coberturas pc
JOIN planos p ON p.id = pc.plano_id
WHERE eer.entity_type = 'cobertura'
  AND eer.entity_id = pc.cobertura_id
  AND eer.rule_type = 'tipo_uso'
  AND p.nome ILIKE '%aplicativo%'
  AND eer.rule_config::text = '{"values": ["particular"]}';

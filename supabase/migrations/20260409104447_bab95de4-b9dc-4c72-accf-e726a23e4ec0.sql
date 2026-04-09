
-- 1) tipo_placa para coberturas de deságio
INSERT INTO entity_eligibility_rules (entity_type, entity_id, rule_type, rule_config, is_active)
SELECT DISTINCT 'cobertura', pc.cobertura_id, 'tipo_placa',
  '{"values": ["chassi_remarcado", "placa_vermelha", "veiculo_que_ja_teve_ressarcimento_integral", "taxi", "leilao", "ex_taxi"]}'::jsonb,
  true
FROM planos p
JOIN planos_coberturas pc ON pc.plano_id = p.id
WHERE (p.nome ILIKE '%deságio%' OR p.nome ILIKE '%desagio%')
AND NOT EXISTS(
  SELECT 1 FROM entity_eligibility_rules eer
  WHERE eer.entity_id = pc.cobertura_id AND eer.entity_type = 'cobertura' AND eer.rule_type = 'tipo_placa'
);

-- 2) tipo_placa para benefícios de deságio
INSERT INTO entity_eligibility_rules (entity_type, entity_id, rule_type, rule_config, is_active)
SELECT DISTINCT 'beneficio', pb.benefit_id, 'tipo_placa',
  '{"values": ["chassi_remarcado", "placa_vermelha", "veiculo_que_ja_teve_ressarcimento_integral", "taxi", "leilao", "ex_taxi"]}'::jsonb,
  true
FROM planos p
JOIN planos_beneficios pb ON pb.plano_id = p.id
WHERE (p.nome ILIKE '%deságio%' OR p.nome ILIKE '%desagio%')
AND NOT EXISTS(
  SELECT 1 FROM entity_eligibility_rules eer
  WHERE eer.entity_id = pb.benefit_id AND eer.entity_type = 'beneficio' AND eer.rule_type = 'tipo_placa'
);

-- 3) combustivel=diesel para benefícios de planos diesel
INSERT INTO entity_eligibility_rules (entity_type, entity_id, rule_type, rule_config, is_active)
SELECT DISTINCT 'beneficio', pb.benefit_id, 'combustivel',
  '{"values": ["diesel"]}'::jsonb,
  true
FROM planos p
JOIN planos_beneficios pb ON pb.plano_id = p.id
WHERE p.nome ILIKE '%diesel%'
AND NOT EXISTS(
  SELECT 1 FROM entity_eligibility_rules eer
  WHERE eer.entity_id = pb.benefit_id AND eer.entity_type = 'beneficio' AND eer.rule_type = 'combustivel'
);

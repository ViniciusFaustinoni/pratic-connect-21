
-- ============================================================
-- PARTE 1: Duplicar benefícios para cada plano (tornar exclusivos)
-- ============================================================
DO $$
DECLARE
  rec RECORD;
  new_benefit_id UUID;
  orig_benefit RECORD;
  rule_rec RECORD;
  excl_rec RECORD;
BEGIN
  FOR rec IN 
    SELECT pb.id AS pb_id, pb.plano_id, pb.benefit_id
    FROM planos_beneficios pb
    JOIN planos p ON p.id = pb.plano_id
    WHERE pb.benefit_id IS NOT NULL
  LOOP
    SELECT * INTO orig_benefit FROM benefits WHERE id = rec.benefit_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    new_benefit_id := gen_random_uuid();

    INSERT INTO benefits (
      id, name, slug, description, icon, category, preco_sugerido,
      carencia_dias, carencia_ativa, carencia_tipo, carencia_multiplicador,
      is_active, display_order, created_at
    ) VALUES (
      new_benefit_id,
      orig_benefit.name,
      orig_benefit.slug || '-' || LEFT(rec.plano_id::text, 8),
      orig_benefit.description,
      orig_benefit.icon,
      orig_benefit.category,
      orig_benefit.preco_sugerido,
      orig_benefit.carencia_dias,
      orig_benefit.carencia_ativa,
      orig_benefit.carencia_tipo,
      orig_benefit.carencia_multiplicador,
      orig_benefit.is_active,
      orig_benefit.display_order,
      NOW()
    );

    UPDATE planos_beneficios SET benefit_id = new_benefit_id WHERE id = rec.pb_id;

    FOR rule_rec IN
      SELECT * FROM entity_eligibility_rules
      WHERE entity_type = 'benefit' AND entity_id = rec.benefit_id
    LOOP
      INSERT INTO entity_eligibility_rules (
        entity_type, entity_id, rule_type, rule_config, is_active, created_at
      ) VALUES (
        'benefit', new_benefit_id, rule_rec.rule_type, rule_rec.rule_config, rule_rec.is_active, NOW()
      );
    END LOOP;

    FOR excl_rec IN
      SELECT * FROM benefit_category_exclusions
      WHERE benefit_id = rec.benefit_id
    LOOP
      INSERT INTO benefit_category_exclusions (
        benefit_id, categoria_veiculo, created_at
      ) VALUES (
        new_benefit_id, excl_rec.categoria_veiculo, NOW()
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- PARTE 2: Corrigir combustível nas coberturas dos planos Diesel
-- ============================================================
UPDATE entity_eligibility_rules eer
SET rule_config = jsonb_set(eer.rule_config, '{values}', '["diesel"]'::jsonb)
FROM planos_coberturas pc
JOIN planos p ON p.id = pc.plano_id
WHERE eer.entity_type = 'cobertura'
  AND eer.entity_id = pc.cobertura_id
  AND eer.rule_type = 'combustivel'
  AND p.nome ILIKE '%diesel%'
  AND (
    eer.rule_config->'values' @> '"flex"'::jsonb
    OR eer.rule_config->'values' @> '"gasolina"'::jsonb
  )
  AND NOT (eer.rule_config->'values' @> '"diesel"'::jsonb);

-- ============================================================
-- PARTE 3: Corrigir ano invertido da Linha Especial
-- ============================================================
UPDATE entity_eligibility_rules
SET rule_config = jsonb_set(
  jsonb_set(rule_config, '{ano_min}', '1994'::jsonb),
  '{ano_max}', 'null'::jsonb
)
WHERE entity_type = 'linha'
  AND entity_id = '16820bb0-814a-4fa1-ae02-bf4ad7285e64'
  AND rule_type = 'ano_fabricacao'
  AND (rule_config->>'ano_min')::int > (rule_config->>'ano_max')::int;

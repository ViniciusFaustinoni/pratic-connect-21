
DO $$
DECLARE
  rec RECORD;
  plan_rec RECORD;
  new_cob_id UUID;
  is_first BOOLEAN;
  seq INT;
BEGIN
  FOR rec IN
    SELECT c.id as cobertura_id
    FROM coberturas c
    JOIN planos_coberturas pc ON pc.cobertura_id = c.id
    GROUP BY c.id
    HAVING count(*) > 1
  LOOP
    is_first := TRUE;
    seq := 1;

    FOR plan_rec IN
      SELECT pc.plano_id, pc.id as link_id
      FROM planos_coberturas pc
      WHERE pc.cobertura_id = rec.cobertura_id
      ORDER BY pc.created_at ASC
    LOOP
      IF is_first THEN
        is_first := FALSE;
        CONTINUE;
      END IF;

      INSERT INTO coberturas (
        codigo, nome, descricao, tipo, percentual_cobertura, valor_limite,
        franquia_percentual, franquia_valor, carencia_dias, ativo,
        icon, subtitle, display_order, valor,
        carencia_ativa, carencia_tipo, carencia_multiplicador
      )
      SELECT
        left(codigo, 90) || '-c' || seq,
        nome, descricao, tipo, percentual_cobertura, valor_limite,
        franquia_percentual, franquia_valor, carencia_dias, ativo,
        icon, subtitle, display_order, valor,
        carencia_ativa, carencia_tipo, carencia_multiplicador
      FROM coberturas
      WHERE id = rec.cobertura_id
      RETURNING id INTO new_cob_id;

      UPDATE planos_coberturas
      SET cobertura_id = new_cob_id
      WHERE id = plan_rec.link_id;

      INSERT INTO entity_eligibility_rules (
        entity_type, entity_id, rule_type, rule_config
      )
      SELECT entity_type, new_cob_id, rule_type, rule_config
      FROM entity_eligibility_rules
      WHERE entity_type = 'cobertura'
        AND entity_id = rec.cobertura_id;

      seq := seq + 1;
    END LOOP;
  END LOOP;
END;
$$;

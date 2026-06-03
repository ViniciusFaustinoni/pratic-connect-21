
DO $$
DECLARE
  v_keep uuid := 'e32ebd06-cf96-4e3f-be86-531dba5bf8c8';
  v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids
  FROM planos
  WHERE (nome ILIKE '% - SP' OR nome ILIKE '% - Lagos')
    AND id <> v_keep;

  RAISE NOTICE 'Planos a excluir: %', array_length(v_ids,1);

  UPDATE cotacoes SET plano_id = NULL WHERE plano_id = ANY(v_ids);
  UPDATE cotacoes SET plano_escolhido_id = NULL WHERE plano_escolhido_id = ANY(v_ids);
  DELETE FROM planos_regioes        WHERE plano_id = ANY(v_ids);
  DELETE FROM planos_beneficios     WHERE plano_id = ANY(v_ids);
  DELETE FROM planos_coberturas     WHERE plano_id = ANY(v_ids);
  DELETE FROM planos_restricoes     WHERE plano_id = ANY(v_ids);
  DELETE FROM entity_eligibility_rules WHERE entity_type='plano' AND entity_id = ANY(v_ids);
  DELETE FROM planos WHERE id = ANY(v_ids);
END $$;

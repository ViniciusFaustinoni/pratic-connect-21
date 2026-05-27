DO $$
DECLARE
  v_assoc uuid := 'a96c1136-96ff-4839-a9cd-199d70eedc67';
  v_email text := 'marcosdativo@gmail.com';
  v_cpfs text[] := ARRAY['141.948.967-42','14194896742'];
  v_contrato_ids uuid[];
  v_veiculo_ids uuid[];
  v_cotacao_ids uuid[];
  v_servico_ids uuid[];
  v_vistoria_ids uuid[];
  v_instalacao_ids uuid[];
  fk RECORD;
  v_sql text;
  v_deleted bigint;
BEGIN
  SELECT array_agg(id) INTO v_contrato_ids FROM contratos WHERE associado_id = v_assoc;
  SELECT array_agg(id) INTO v_veiculo_ids  FROM veiculos  WHERE associado_id = v_assoc;
  SELECT array_agg(id) INTO v_cotacao_ids  FROM cotacoes
    WHERE cliente_cpf = ANY(v_cpfs)
       OR email_solicitante = v_email
       OR contrato_gerado_id = ANY(COALESCE(v_contrato_ids, ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_servico_ids  FROM servicos
    WHERE associado_id = v_assoc
       OR contrato_id  = ANY(COALESCE(v_contrato_ids, ARRAY[]::uuid[]))
       OR veiculo_id   = ANY(COALESCE(v_veiculo_ids,  ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_vistoria_ids FROM vistorias
    WHERE associado_id = v_assoc
       OR contrato_id  = ANY(COALESCE(v_contrato_ids, ARRAY[]::uuid[]))
       OR veiculo_id   = ANY(COALESCE(v_veiculo_ids,  ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_instalacao_ids FROM instalacoes
    WHERE associado_id = v_assoc
       OR contrato_id  = ANY(COALESCE(v_contrato_ids, ARRAY[]::uuid[]))
       OR veiculo_id   = ANY(COALESCE(v_veiculo_ids,  ARRAY[]::uuid[]));

  SET LOCAL session_replication_role = 'replica';

  UPDATE rastreadores
     SET veiculo_id = NULL, associado_id = NULL, updated_at = now()
   WHERE veiculo_id  = ANY(COALESCE(v_veiculo_ids, ARRAY[]::uuid[]))
      OR associado_id = v_assoc;

  FOR fk IN
    SELECT cl.relname AS child_table, att.attname AS child_column, cf.relname AS parent_table
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_class cf ON cf.oid = con.confrelid
    JOIN pg_namespace nc ON nc.oid = cl.relnamespace AND nc.nspname = 'public'
    JOIN pg_namespace np ON np.oid = cf.relnamespace AND np.nspname = 'public'
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND cf.relname IN ('associados','contratos','veiculos','cotacoes','servicos','vistorias','instalacoes')
      AND cl.relname NOT IN ('associados','contratos','veiculos','cotacoes','servicos','vistorias','instalacoes','rastreadores')
  LOOP
    v_sql := format('DELETE FROM public.%I WHERE %I = ANY($1)', fk.child_table, fk.child_column);
    BEGIN
      CASE fk.parent_table
        WHEN 'associados'  THEN EXECUTE v_sql USING ARRAY[v_assoc];
        WHEN 'contratos'   THEN IF v_contrato_ids   IS NOT NULL THEN EXECUTE v_sql USING v_contrato_ids;   END IF;
        WHEN 'veiculos'    THEN IF v_veiculo_ids    IS NOT NULL THEN EXECUTE v_sql USING v_veiculo_ids;    END IF;
        WHEN 'cotacoes'    THEN IF v_cotacao_ids    IS NOT NULL THEN EXECUTE v_sql USING v_cotacao_ids;    END IF;
        WHEN 'servicos'    THEN IF v_servico_ids    IS NOT NULL THEN EXECUTE v_sql USING v_servico_ids;    END IF;
        WHEN 'vistorias'   THEN IF v_vistoria_ids   IS NOT NULL THEN EXECUTE v_sql USING v_vistoria_ids;   END IF;
        WHEN 'instalacoes' THEN IF v_instalacao_ids IS NOT NULL THEN EXECUTE v_sql USING v_instalacao_ids; END IF;
      END CASE;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      IF v_deleted > 0 THEN RAISE NOTICE 'DEL %.% (-> %): %', fk.child_table, fk.child_column, fk.parent_table, v_deleted; END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP %.% (-> %): %', fk.child_table, fk.child_column, fk.parent_table, SQLERRM;
    END;
  END LOOP;

  IF v_vistoria_ids   IS NOT NULL THEN DELETE FROM vistorias   WHERE id = ANY(v_vistoria_ids); END IF;
  IF v_servico_ids    IS NOT NULL THEN DELETE FROM servicos    WHERE id = ANY(v_servico_ids); END IF;
  IF v_instalacao_ids IS NOT NULL THEN DELETE FROM instalacoes WHERE id = ANY(v_instalacao_ids); END IF;
  IF v_cotacao_ids    IS NOT NULL THEN DELETE FROM cotacoes    WHERE id = ANY(v_cotacao_ids); END IF;
  IF v_contrato_ids   IS NOT NULL THEN DELETE FROM contratos   WHERE id = ANY(v_contrato_ids); END IF;
  IF v_veiculo_ids    IS NOT NULL THEN DELETE FROM veiculos    WHERE id = ANY(v_veiculo_ids); END IF;
  DELETE FROM associados WHERE id = v_assoc;

  SET LOCAL session_replication_role = 'origin';

  BEGIN
    INSERT INTO logs_auditoria (acao, entidade, descricao, created_at)
    VALUES ('excluir','associado',
            'Hard delete MARCOS VINICIUS DATIVO MACHADO (CPF 141.948.967-42 / id a96c1136-96ff-4839-a9cd-199d70eedc67) por solicitacao direta',
            now());
  EXCEPTION WHEN OTHERS THEN NULL; END;
END$$;
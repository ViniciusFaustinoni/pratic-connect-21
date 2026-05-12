DO $$
DECLARE
  v_associado uuid := '6ab4887f-90d6-4fa3-b691-9b07828ddda7';
  v_veiculos  uuid[] := ARRAY['1e8e2800-6484-4681-a9b4-7b1698cd89c8','66d300b6-9a33-4582-a4b7-6fd820d1476a']::uuid[];
  v_contratos uuid[] := ARRAY['55829b14-ef8b-46de-8ad9-6bf6952a3f84','a1eacdc0-0438-4abd-8c1b-0985f32549c9','35aec693-a89c-43ec-8754-9df9567a12b8']::uuid[];
  v_cotacoes  uuid[];
  fk record;
  v_pass int;
  c_id uuid;
  cot_id uuid;
BEGIN
  -- Coletar todas as cotações vinculadas a esses contratos OU ao associado MARCOS
  SELECT array_agg(DISTINCT id) INTO v_cotacoes FROM cotacoes
   WHERE contrato_gerado_id = ANY(v_contratos)
      OR cliente_cpf IN ('14194896742','141.948.967-42')
      OR id = 'cb33a06d-2d82-4704-9eda-f18df47c6fdd';
  IF v_cotacoes IS NULL THEN v_cotacoes := ARRAY[]::uuid[]; END IF;

  -- Liberar rastreadores
  UPDATE rastreadores
     SET veiculo_id=NULL, associado_id=NULL, status='estoque',
         plataforma_veiculo_id=NULL, plataforma_user_id=NULL
   WHERE associado_id = v_associado OR veiculo_id = ANY(v_veiculos);

  FOR v_pass IN 1..5 LOOP
    FOR fk IN
      SELECT cl.relname AS tbl, a.attname AS col, rcl.relname AS ref_tbl, a.attnotnull AS notnull
        FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace
        JOIN pg_class rcl ON rcl.oid = c.confrelid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype='f' AND n.nspname='public'
         AND rcl.relname IN ('associados','contratos','veiculos','cotacoes')
         AND cl.relname NOT IN ('rastreadores','logs_auditoria','associados','contratos','veiculos','cotacoes')
    LOOP
      BEGIN
        IF fk.ref_tbl='associados' THEN
          EXECUTE format('DELETE FROM public.%I WHERE %I = $1', fk.tbl, fk.col) USING v_associado;
        ELSIF fk.ref_tbl='contratos' THEN
          EXECUTE format('DELETE FROM public.%I WHERE %I = ANY($1)', fk.tbl, fk.col) USING v_contratos;
        ELSIF fk.ref_tbl='cotacoes' THEN
          EXECUTE format('DELETE FROM public.%I WHERE %I = ANY($1)', fk.tbl, fk.col) USING v_cotacoes;
        ELSIF fk.ref_tbl='veiculos' THEN
          EXECUTE format('DELETE FROM public.%I WHERE %I = ANY($1)', fk.tbl, fk.col) USING v_veiculos;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        IF NOT fk.notnull THEN
          BEGIN
            IF fk.ref_tbl='associados' THEN
              EXECUTE format('UPDATE public.%I SET %I=NULL WHERE %I = $1', fk.tbl, fk.col, fk.col) USING v_associado;
            ELSIF fk.ref_tbl='contratos' THEN
              EXECUTE format('UPDATE public.%I SET %I=NULL WHERE %I = ANY($1)', fk.tbl, fk.col, fk.col) USING v_contratos;
            ELSIF fk.ref_tbl='cotacoes' THEN
              EXECUTE format('UPDATE public.%I SET %I=NULL WHERE %I = ANY($1)', fk.tbl, fk.col, fk.col) USING v_cotacoes;
            ELSIF fk.ref_tbl='veiculos' THEN
              EXECUTE format('UPDATE public.%I SET %I=NULL WHERE %I = ANY($1)', fk.tbl, fk.col, fk.col) USING v_veiculos;
            END IF;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;
      END;
    END LOOP;
  END LOOP;

  -- FKs cruzadas
  UPDATE cotacoes  SET contrato_gerado_id = NULL WHERE contrato_gerado_id = ANY(v_contratos);
  BEGIN UPDATE associados SET contrato_id = NULL WHERE contrato_id = ANY(v_contratos); EXCEPTION WHEN undefined_column THEN NULL; END;

  -- Núcleo
  DELETE FROM contratos  WHERE id = ANY(v_contratos);
  DELETE FROM cotacoes   WHERE id = ANY(v_cotacoes);
  DELETE FROM veiculos   WHERE id = ANY(v_veiculos);
  DELETE FROM associados WHERE id = v_associado;

  INSERT INTO logs_auditoria (usuario_nome, acao, modulo, descricao, tabela, registro_id, dados_anteriores)
  VALUES (
    'SISTEMA - Migration', 'excluir', 'associados',
    'Exclusão Power CRM externo: MARCOS VINICIUS DATIVO MACHADO + QOO5C17 + KOU6D37 + 3 contratos. Mantido MARCUS FAUSTINONI + LTB4J74.',
    'associados', v_associado,
    jsonb_build_object('associado', v_associado, 'veiculos', v_veiculos, 'contratos', v_contratos, 'cotacoes', v_cotacoes, 'motivo', 'Power CRM externo')
  );
END $$;
DO $$
DECLARE
  v_assocs uuid[] := ARRAY['1723a600-199d-48fb-993d-e1f3422b5618','53dabfdc-98c4-42c3-ae86-371a93809917']::uuid[];
  v_veics  uuid[] := ARRAY['af4c89bf-a01b-446c-9536-dd412af141a0','d6af73ae-dd6b-4359-a826-ff8ef0a05333','f2595b44-9a72-4d88-b28d-e6dad4b4cf9a']::uuid[];
  v_contratos uuid[] := ARRAY['979566ad-0e20-4d3e-b3ad-cf6cb85075ff']::uuid[];
  v_cotacoes uuid[] := ARRAY['5b92ff5c-a3f1-4e8a-8010-b4054cccd436']::uuid[];
  rec record;
  pass int;
BEGIN
  -- 1) Desvincula rastreadores (volta para estoque)
  UPDATE public.rastreadores
     SET veiculo_id = NULL, associado_id = NULL, status = 'estoque'
   WHERE associado_id = ANY(v_assocs) OR veiculo_id = ANY(v_veics);

  -- 2) Limpa todas as FKs (3 passes para resolver cadeias aninhadas)
  FOR pass IN 1..3 LOOP
    FOR rec IN
      SELECT ns.nspname AS schema_name, cl.relname AS table_name, att.attname AS column_name, fcl.relname AS ref_table
      FROM pg_constraint con
      JOIN pg_class cl ON cl.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      JOIN pg_class fcl ON fcl.oid = con.confrelid
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
      WHERE con.contype = 'f' AND ns.nspname = 'public'
        AND fcl.relname IN ('associados','veiculos','contratos','cotacoes')
        AND cl.relname NOT IN ('associados','veiculos','contratos','rastreadores','cotacoes')
    LOOP
      BEGIN
        IF rec.ref_table = 'associados' THEN
          EXECUTE format('DELETE FROM %I.%I WHERE %I = ANY($1)', rec.schema_name, rec.table_name, rec.column_name) USING v_assocs;
        ELSIF rec.ref_table = 'veiculos' THEN
          EXECUTE format('DELETE FROM %I.%I WHERE %I = ANY($1)', rec.schema_name, rec.table_name, rec.column_name) USING v_veics;
        ELSIF rec.ref_table = 'contratos' THEN
          EXECUTE format('DELETE FROM %I.%I WHERE %I = ANY($1)', rec.schema_name, rec.table_name, rec.column_name) USING v_contratos;
        ELSIF rec.ref_table = 'cotacoes' THEN
          EXECUTE format('DELETE FROM %I.%I WHERE %I = ANY($1)', rec.schema_name, rec.table_name, rec.column_name) USING v_cotacoes;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'skip %.% col %: %', rec.schema_name, rec.table_name, rec.column_name, SQLERRM;
      END;
    END LOOP;
  END LOOP;

  -- 3) Tabelas raiz na ordem certa
  DELETE FROM public.cotacoes WHERE id = ANY(v_cotacoes);
  DELETE FROM public.contratos WHERE id = ANY(v_contratos);
  DELETE FROM public.veiculos WHERE id = ANY(v_veics);
  DELETE FROM public.associados WHERE id = ANY(v_assocs);
END $$;
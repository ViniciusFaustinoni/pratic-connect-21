SET session_replication_role = replica;

DO $$
DECLARE
  v_assoc_ids uuid[] := ARRAY['2e8c514d-d835-4e4d-8db0-b375438a0985','952fa2cb-afce-47b0-b3ed-e5bbf6bb4ef1']::uuid[];
  v_veic_ids uuid[] := ARRAY['934879bc-4399-44a1-a3b1-2ddbab39c526','fb1c683c-b2ed-44d6-bc1c-69bfceca94d6','d1cb2326-2910-4afd-b0d2-ba109ece7f82','3930459f-465e-4731-93f9-4f6d317a4ddb']::uuid[];
  v_contr_ids uuid[] := ARRAY['496584d1-efeb-438c-985a-8afc0e42fef2','bfa583c8-ab16-4faf-928f-78f88af81c27','301d5f91-8ebd-47c3-b561-5a37fd5ea190','04708d9a-9f80-490a-814e-3a353ce07335']::uuid[];
  v_troca_id uuid := '4d95e8e4-bb5c-4a1a-959b-c3f9d4069302';
  v_vist_ids uuid[];
  v_inst_ids uuid[];
  v_cot_ids uuid[];
  t text;
BEGIN
  SELECT array_agg(DISTINCT c.id) INTO v_cot_ids FROM cotacoes c
   WHERE c.id='d54f5604-faea-4c51-84a4-eac7fa016ccc'
      OR c.contrato_gerado_id = ANY(v_contr_ids)
      OR EXISTS(SELECT 1 FROM contratos ct WHERE ct.id = ANY(v_contr_ids) AND ct.cotacao_id = c.id)
      OR EXISTS(SELECT 1 FROM veiculos v WHERE v.id = ANY(v_veic_ids) AND v.placa = c.veiculo_placa);

  SELECT array_agg(id) INTO v_vist_ids FROM vistorias WHERE veiculo_id = ANY(v_veic_ids) OR contrato_id = ANY(v_contr_ids) OR cotacao_id = ANY(COALESCE(v_cot_ids,'{}'::uuid[]));
  SELECT array_agg(id) INTO v_inst_ids FROM instalacoes WHERE veiculo_id = ANY(v_veic_ids) OR contrato_id = ANY(v_contr_ids) OR cotacao_id = ANY(COALESCE(v_cot_ids,'{}'::uuid[]));

  -- desvincular rastreadores (mantém o equipamento no estoque)
  UPDATE rastreadores SET veiculo_id=NULL, associado_id=NULL, status='estoque'
   WHERE veiculo_id = ANY(v_veic_ids) OR associado_id = ANY(v_assoc_ids);

  -- Apaga em qualquer tabela que referencie contratos/veiculos/associados/cotacoes
  FOR t IN
    SELECT DISTINCT conrelid::regclass::text
    FROM pg_constraint c
    WHERE c.contype='f'
      AND confrelid::regclass::text IN ('contratos','veiculos','associados','cotacoes')
      AND conrelid::regclass::text NOT IN ('contratos','veiculos','associados','cotacoes','rastreadores')
  LOOP
    BEGIN
      EXECUTE format($f$
        DELETE FROM %s WHERE
          (to_jsonb(t) ? 'contrato_id' AND (t.contrato_id::text = ANY($1::text[])))
          OR (to_jsonb(t) ? 'contrato_novo_id' AND (t.contrato_novo_id::text = ANY($1::text[])))
          OR (to_jsonb(t) ? 'contrato_gerado_id' AND (t.contrato_gerado_id::text = ANY($1::text[])))
          OR (to_jsonb(t) ? 'veiculo_id' AND (t.veiculo_id::text = ANY($2::text[])))
          OR (to_jsonb(t) ? 'associado_id' AND (t.associado_id::text = ANY($3::text[])))
          OR (to_jsonb(t) ? 'indicador_id' AND (t.indicador_id::text = ANY($3::text[])))
          OR (to_jsonb(t) ? 'cotacao_id' AND (t.cotacao_id::text = ANY($4::text[])))
          OR (to_jsonb(t) ? 'substituida_por_cotacao_id' AND (t.substituida_por_cotacao_id::text = ANY($4::text[])))
      $f$, t)
      USING (SELECT array_agg(x::text) FROM unnest(v_contr_ids) x),
            (SELECT array_agg(x::text) FROM unnest(v_veic_ids) x),
            (SELECT array_agg(x::text) FROM unnest(v_assoc_ids) x),
            (SELECT array_agg(x::text) FROM unnest(COALESCE(v_cot_ids,'{}'::uuid[])) x);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'skip % : %', t, SQLERRM;
    END;
  END LOOP;

  DELETE FROM relacionamento_debitos_pendentes WHERE solicitacao_troca_id = v_troca_id;
  DELETE FROM solicitacoes_troca_titularidade WHERE id = v_troca_id;

  DELETE FROM cotacoes WHERE id = ANY(COALESCE(v_cot_ids,'{}'::uuid[]));
  DELETE FROM contratos WHERE id = ANY(v_contr_ids);
  DELETE FROM veiculos WHERE id = ANY(v_veic_ids);
  DELETE FROM associados WHERE id = ANY(v_assoc_ids);
END $$;

SET session_replication_role = origin;
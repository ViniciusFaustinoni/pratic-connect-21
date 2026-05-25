
DO $$
DECLARE
  v_assoc uuid[] := ARRAY['05a31afc-77d9-4456-938d-190710394f94'::uuid,'d71b1327-774b-47f0-bfab-af96d9e01246'::uuid];
  v_veic uuid[]; v_contr uuid[]; v_cot uuid[]; v_inst uuid[]; v_vist uuid[];
  v_serv uuid[]; v_ag uuid[]; v_stt uuid[]; v_ssp uuid[]; v_sub uuid[]; v_rast uuid[];
  r record;
  doomed_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_veic FROM veiculos WHERE associado_id = ANY(v_assoc) OR placa IN ('KOU6D37','LTB4J74','QOO5C17');
  SELECT array_agg(id) INTO v_contr FROM contratos WHERE associado_id = ANY(v_assoc) OR veiculo_id = ANY(COALESCE(v_veic,ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_cot FROM cotacoes
    WHERE cliente_cpf IN ('14194896742','12493649737','141.948.967-42','124.936.497-37')
       OR veiculo_placa = ANY(ARRAY['KOU6D37','LTB4J74','QOO5C17']);
  SELECT array_agg(id) INTO v_inst FROM instalacoes WHERE associado_id = ANY(v_assoc) OR veiculo_id = ANY(COALESCE(v_veic,ARRAY[]::uuid[])) OR contrato_id = ANY(COALESCE(v_contr,ARRAY[]::uuid[])) OR cotacao_id = ANY(COALESCE(v_cot,ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_vist FROM vistorias WHERE veiculo_id = ANY(COALESCE(v_veic,ARRAY[]::uuid[])) OR contrato_id = ANY(COALESCE(v_contr,ARRAY[]::uuid[])) OR cotacao_id = ANY(COALESCE(v_cot,ARRAY[]::uuid[])) OR associado_id = ANY(v_assoc) OR instalacao_id = ANY(COALESCE(v_inst,ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_serv FROM servicos WHERE veiculo_id = ANY(COALESCE(v_veic,ARRAY[]::uuid[])) OR contrato_id = ANY(COALESCE(v_contr,ARRAY[]::uuid[])) OR cotacao_id = ANY(COALESCE(v_cot,ARRAY[]::uuid[])) OR associado_id = ANY(v_assoc) OR instalacao_origem_id = ANY(COALESCE(v_inst,ARRAY[]::uuid[])) OR vistoria_origem_id = ANY(COALESCE(v_vist,ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_ag FROM agendamentos_base WHERE cotacao_id = ANY(COALESCE(v_cot,ARRAY[]::uuid[])) OR instalacao_id = ANY(COALESCE(v_inst,ARRAY[]::uuid[])) OR vistoria_id = ANY(COALESCE(v_vist,ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_stt FROM solicitacoes_troca_titularidade WHERE associado_antigo_id = ANY(v_assoc) OR novo_associado_id = ANY(v_assoc) OR veiculo_id = ANY(COALESCE(v_veic,ARRAY[]::uuid[])) OR cotacao_id = ANY(COALESCE(v_cot,ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_ssp FROM solicitacoes_substituicao_placa WHERE associado_id = ANY(v_assoc) OR cotacao_id = ANY(COALESCE(v_cot,ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_sub FROM substituicoes_veiculo WHERE associado_id = ANY(v_assoc) OR veiculo_antigo_id = ANY(COALESCE(v_veic,ARRAY[]::uuid[])) OR veiculo_novo_id = ANY(COALESCE(v_veic,ARRAY[]::uuid[])) OR contrato_novo_id = ANY(COALESCE(v_contr,ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_rast FROM rastreadores WHERE associado_id = ANY(v_assoc) OR veiculo_id = ANY(COALESCE(v_veic,ARRAY[]::uuid[]));

  RAISE NOTICE 'Escopo: assoc=% veic=% contr=% cot=% inst=% vist=% serv=% ag=% stt=% ssp=% sub=% rast=%',
    array_length(v_assoc,1), array_length(v_veic,1), array_length(v_contr,1), array_length(v_cot,1),
    array_length(v_inst,1), array_length(v_vist,1), array_length(v_serv,1), array_length(v_ag,1),
    array_length(v_stt,1), array_length(v_ssp,1), array_length(v_sub,1), array_length(v_rast,1);

  -- Restock rastreadores
  IF v_rast IS NOT NULL THEN
    UPDATE rastreadores SET veiculo_id = NULL, associado_id = NULL, status = 'estoque' WHERE id = ANY(v_rast);
  END IF;

  -- Apaga filhos via varredura de FKs
  FOR r IN
    SELECT c.conrelid::regclass::text AS child_tbl,
           a.attname AS child_col,
           cl.relname AS parent_tbl
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND cl.relname IN ('associados','veiculos','contratos','cotacoes','instalacoes','vistorias','servicos','agendamentos_base','solicitacoes_troca_titularidade','solicitacoes_substituicao_placa','substituicoes_veiculo')
      AND c.conrelid::regclass::text NOT IN ('public.logs_auditoria','public.rastreadores',
        'public.associados','public.veiculos','public.contratos','public.cotacoes',
        'public.instalacoes','public.vistorias','public.servicos','public.agendamentos_base',
        'public.solicitacoes_troca_titularidade','public.solicitacoes_substituicao_placa','public.substituicoes_veiculo')
  LOOP
    doomed_ids := CASE r.parent_tbl
      WHEN 'associados' THEN v_assoc
      WHEN 'veiculos' THEN v_veic
      WHEN 'contratos' THEN v_contr
      WHEN 'cotacoes' THEN v_cot
      WHEN 'instalacoes' THEN v_inst
      WHEN 'vistorias' THEN v_vist
      WHEN 'servicos' THEN v_serv
      WHEN 'agendamentos_base' THEN v_ag
      WHEN 'solicitacoes_troca_titularidade' THEN v_stt
      WHEN 'solicitacoes_substituicao_placa' THEN v_ssp
      WHEN 'substituicoes_veiculo' THEN v_sub
    END;
    IF doomed_ids IS NULL OR array_length(doomed_ids,1) IS NULL THEN CONTINUE; END IF;
    BEGIN
      EXECUTE format('DELETE FROM %s WHERE %I = ANY($1)', r.child_tbl, r.child_col) USING doomed_ids;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FK cleanup failed % %.%: %', r.parent_tbl, r.child_tbl, r.child_col, SQLERRM;
    END;
  END LOOP;

  -- Apaga FKs internas (self-refs entre as 11 tabelas-alvo) na ordem mais segura
  IF v_ag    IS NOT NULL THEN DELETE FROM agendamentos_base WHERE id = ANY(v_ag); END IF;
  IF v_serv  IS NOT NULL THEN DELETE FROM servicos WHERE id = ANY(v_serv); END IF;
  IF v_vist  IS NOT NULL THEN DELETE FROM vistorias WHERE id = ANY(v_vist); END IF;
  IF v_inst  IS NOT NULL THEN DELETE FROM instalacoes WHERE id = ANY(v_inst); END IF;
  IF v_sub   IS NOT NULL THEN DELETE FROM substituicoes_veiculo WHERE id = ANY(v_sub); END IF;
  IF v_ssp   IS NOT NULL THEN DELETE FROM solicitacoes_substituicao_placa WHERE id = ANY(v_ssp); END IF;
  IF v_stt   IS NOT NULL THEN DELETE FROM solicitacoes_troca_titularidade WHERE id = ANY(v_stt); END IF;
  IF v_cot   IS NOT NULL THEN DELETE FROM cotacoes WHERE id = ANY(v_cot); END IF;
  IF v_contr IS NOT NULL THEN DELETE FROM contratos WHERE id = ANY(v_contr); END IF;
  IF v_veic  IS NOT NULL THEN DELETE FROM veiculos WHERE id = ANY(v_veic); END IF;
  DELETE FROM associados WHERE id = ANY(v_assoc);
END $$;

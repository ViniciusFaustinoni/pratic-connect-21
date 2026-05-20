DO $$
DECLARE
  v_assoc uuid := '7478196b-eb31-4b91-86e6-052650a79e98';
  v_cot_troca uuid := '1366694f-5baa-4b2c-b306-28af6e80eeac';
  v_assoc_cpf text;
  v_veh_ids uuid[];
  v_contrato_ids uuid[];
  v_cot_ids uuid[];
  v_vist_ids uuid[];
  v_inst_ids uuid[];
BEGIN
  SELECT cpf INTO v_assoc_cpf FROM associados WHERE id = v_assoc;
  SELECT array_agg(id) INTO v_veh_ids FROM veiculos WHERE associado_id = v_assoc;
  SELECT array_agg(id) INTO v_contrato_ids FROM contratos WHERE associado_id = v_assoc;
  SELECT array_agg(id) INTO v_cot_ids FROM cotacoes
    WHERE id = v_cot_troca
       OR contrato_gerado_id = ANY(COALESCE(v_contrato_ids, ARRAY[]::uuid[]))
       OR (v_assoc_cpf IS NOT NULL AND regexp_replace(cliente_cpf,'\D','','g') = regexp_replace(v_assoc_cpf,'\D','','g'));
  SELECT array_agg(id) INTO v_vist_ids FROM vistorias
    WHERE veiculo_id = ANY(COALESCE(v_veh_ids, ARRAY[]::uuid[]))
       OR contrato_id = ANY(COALESCE(v_contrato_ids, ARRAY[]::uuid[]))
       OR associado_id = v_assoc
       OR cotacao_id = ANY(COALESCE(v_cot_ids, ARRAY[]::uuid[]));
  SELECT array_agg(id) INTO v_inst_ids FROM instalacoes
    WHERE contrato_id = ANY(COALESCE(v_contrato_ids, ARRAY[]::uuid[]))
       OR cotacao_id   = ANY(COALESCE(v_cot_ids, ARRAY[]::uuid[]))
       OR veiculo_id   = ANY(COALESCE(v_veh_ids, ARRAY[]::uuid[]));

  UPDATE rastreadores
     SET veiculo_id = NULL, associado_id = NULL, status = 'estoque'
   WHERE associado_id = v_assoc
      OR veiculo_id = ANY(COALESCE(v_veh_ids, ARRAY[]::uuid[]));

  DELETE FROM solicitacoes_troca_titularidade
   WHERE cotacao_id = ANY(COALESCE(v_cot_ids, ARRAY[]::uuid[]))
      OR associado_antigo_id = v_assoc
      OR veiculo_id = ANY(COALESCE(v_veh_ids, ARRAY[]::uuid[]));

  DELETE FROM cotacoes_vistoria_fotos WHERE cotacao_id = ANY(COALESCE(v_cot_ids, ARRAY[]::uuid[]));
  DELETE FROM contratos_documentos WHERE contrato_id = ANY(COALESCE(v_contrato_ids, ARRAY[]::uuid[]));
  DELETE FROM cobrancas WHERE contrato_id = ANY(COALESCE(v_contrato_ids, ARRAY[]::uuid[]))
                            OR associado_id = v_assoc;

  DELETE FROM agendamentos_base
   WHERE cotacao_id    = ANY(COALESCE(v_cot_ids, ARRAY[]::uuid[]))
      OR vistoria_id   = ANY(COALESCE(v_vist_ids, ARRAY[]::uuid[]))
      OR instalacao_id = ANY(COALESCE(v_inst_ids, ARRAY[]::uuid[]));

  DELETE FROM servicos
   WHERE contrato_id        = ANY(COALESCE(v_contrato_ids, ARRAY[]::uuid[]))
      OR cotacao_id          = ANY(COALESCE(v_cot_ids, ARRAY[]::uuid[]))
      OR veiculo_id          = ANY(COALESCE(v_veh_ids, ARRAY[]::uuid[]))
      OR associado_id        = v_assoc
      OR vistoria_origem_id  = ANY(COALESCE(v_vist_ids, ARRAY[]::uuid[]))
      OR instalacao_origem_id = ANY(COALESCE(v_inst_ids, ARRAY[]::uuid[]));

  DELETE FROM vistoria_fotos WHERE vistoria_id = ANY(COALESCE(v_vist_ids, ARRAY[]::uuid[]));
  DELETE FROM instalacoes WHERE id = ANY(COALESCE(v_inst_ids, ARRAY[]::uuid[]));
  DELETE FROM vistorias WHERE id = ANY(COALESCE(v_vist_ids, ARRAY[]::uuid[]));

  DELETE FROM cotacoes WHERE id = ANY(COALESCE(v_cot_ids, ARRAY[]::uuid[]));
  DELETE FROM contratos WHERE id = ANY(COALESCE(v_contrato_ids, ARRAY[]::uuid[]));
  DELETE FROM veiculos WHERE id = ANY(COALESCE(v_veh_ids, ARRAY[]::uuid[]));
  DELETE FROM associados WHERE id = v_assoc;
END $$;
DO $$
DECLARE
  v_assoc_ids uuid[] := ARRAY[
    '3b8f4e96-71e6-4e96-9de7-b5a3f8ab56c3'::uuid,
    '79809db0-a25b-4518-accf-884274fafc08'::uuid
  ];
  v_assoc_cpfs text[] := ARRAY['12493649737','14194896742'];
  v_veiculo_ids uuid[];
  v_contrato_ids uuid[];
  v_cotacao_ids uuid[];
  stmts text[];
  s text;
BEGIN
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_veiculo_ids FROM veiculos WHERE associado_id = ANY(v_assoc_ids);
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_contrato_ids FROM contratos WHERE associado_id = ANY(v_assoc_ids);
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cotacao_ids FROM cotacoes WHERE cliente_cpf = ANY(v_assoc_cpfs);

  -- Desvincular rastreadores
  BEGIN
    UPDATE rastreadores
       SET veiculo_id = NULL, associado_id = NULL, status = 'em_estoque', updated_at = now()
     WHERE (v_veiculo_ids <> '{}' AND veiculo_id = ANY(v_veiculo_ids))
        OR associado_id = ANY(v_assoc_ids);
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'rastreadores: %', SQLERRM; END;

  stmts := ARRAY[
    format('DELETE FROM vistoria_fotos WHERE vistoria_id IN (SELECT id FROM vistorias WHERE associado_id = ANY(%L) OR veiculo_id = ANY(%L))', v_assoc_ids, v_veiculo_ids),
    format('DELETE FROM vistorias WHERE associado_id = ANY(%L) OR veiculo_id = ANY(%L)', v_assoc_ids, v_veiculo_ids),
    format('DELETE FROM instalacoes WHERE associado_id = ANY(%L) OR veiculo_id = ANY(%L)', v_assoc_ids, v_veiculo_ids),
    format('DELETE FROM agendamentos_base WHERE associado_id = ANY(%L) OR veiculo_id = ANY(%L)', v_assoc_ids, v_veiculo_ids),
    format('DELETE FROM servicos WHERE associado_id = ANY(%L) OR veiculo_id = ANY(%L)', v_assoc_ids, v_veiculo_ids),
    format('DELETE FROM ordens_servico WHERE associado_id = ANY(%L) OR veiculo_id = ANY(%L)', v_assoc_ids, v_veiculo_ids),
    format('DELETE FROM associado_documentos WHERE associado_id = ANY(%L)', v_assoc_ids),
    format('DELETE FROM documentos_associado WHERE associado_id = ANY(%L)', v_assoc_ids),
    format('DELETE FROM documentos WHERE associado_id = ANY(%L)', v_assoc_ids),
    format('DELETE FROM mensalidades WHERE associado_id = ANY(%L) OR contrato_id = ANY(%L)', v_assoc_ids, v_contrato_ids),
    format('DELETE FROM cobrancas WHERE associado_id = ANY(%L) OR contrato_id = ANY(%L)', v_assoc_ids, v_contrato_ids),
    format('DELETE FROM pagamentos WHERE associado_id = ANY(%L) OR contrato_id = ANY(%L)', v_assoc_ids, v_contrato_ids),
    format('DELETE FROM lancamentos_financeiros WHERE associado_id = ANY(%L)', v_assoc_ids),
    format('DELETE FROM sinistros WHERE associado_id = ANY(%L) OR veiculo_id = ANY(%L)', v_assoc_ids, v_veiculo_ids),
    format('DELETE FROM eventos_sinistro WHERE associado_id = ANY(%L) OR veiculo_id = ANY(%L)', v_assoc_ids, v_veiculo_ids),
    format('DELETE FROM contrato_coberturas WHERE contrato_id = ANY(%L)', v_contrato_ids),
    format('DELETE FROM contratos_historico WHERE contrato_id = ANY(%L)', v_contrato_ids),
    format('DELETE FROM ativacao_status_log WHERE associado_id = ANY(%L) OR contrato_id = ANY(%L)', v_assoc_ids, v_contrato_ids),
    format('DELETE FROM contratos WHERE id = ANY(%L)', v_contrato_ids),
    format('DELETE FROM cotacao_planos WHERE cotacao_id = ANY(%L)', v_cotacao_ids),
    format('DELETE FROM cotacoes WHERE id = ANY(%L)', v_cotacao_ids),
    format('DELETE FROM solicitacoes_troca_titularidade WHERE associado_id = ANY(%L) OR novo_associado_id = ANY(%L) OR veiculo_id = ANY(%L)', v_assoc_ids, v_assoc_ids, v_veiculo_ids),
    format('DELETE FROM notificacoes WHERE associado_id = ANY(%L)', v_assoc_ids),
    format('DELETE FROM veiculos WHERE id = ANY(%L)', v_veiculo_ids),
    format('DELETE FROM associados WHERE id = ANY(%L)', v_assoc_ids)
  ];

  FOREACH s IN ARRAY stmts LOOP
    BEGIN
      EXECUTE s;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'IGNORADO [%]: %', s, SQLERRM;
    END;
  END LOOP;
END $$;
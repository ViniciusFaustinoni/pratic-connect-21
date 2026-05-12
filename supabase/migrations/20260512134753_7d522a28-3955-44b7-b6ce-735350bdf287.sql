DO $$
DECLARE
  v_veiculo uuid := 'dac9b84b-79e7-426c-ab82-df2e67ded02d';
  v_associado uuid := '20b50968-3231-484e-9594-890633417240';
  v_contrato_ids uuid[];
  v_cotacao_ids uuid[];
  v_instalacao_ids uuid[];
  v_vistoria_ids uuid[];
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM associados WHERE id = v_associado;
  SELECT array_agg(id) INTO v_contrato_ids FROM contratos WHERE veiculo_id = v_veiculo OR associado_id = v_associado;
  v_contrato_ids := COALESCE(v_contrato_ids, ARRAY[]::uuid[]);
  SELECT array_agg(DISTINCT cotacao_id) INTO v_cotacao_ids FROM contratos WHERE id = ANY(v_contrato_ids) AND cotacao_id IS NOT NULL;
  v_cotacao_ids := COALESCE(v_cotacao_ids, ARRAY[]::uuid[]);
  SELECT array_agg(id) INTO v_instalacao_ids FROM instalacoes WHERE veiculo_id = v_veiculo OR contrato_id = ANY(v_contrato_ids) OR cotacao_id = ANY(v_cotacao_ids) OR associado_id = v_associado;
  v_instalacao_ids := COALESCE(v_instalacao_ids, ARRAY[]::uuid[]);
  SELECT array_agg(id) INTO v_vistoria_ids FROM vistorias WHERE veiculo_id = v_veiculo OR contrato_id = ANY(v_contrato_ids) OR cotacao_id = ANY(v_cotacao_ids) OR associado_id = v_associado OR instalacao_id = ANY(v_instalacao_ids);
  v_vistoria_ids := COALESCE(v_vistoria_ids, ARRAY[]::uuid[]);

  -- Quebrar referência circular contrato<->associado
  UPDATE associados SET contrato_id = NULL WHERE id = v_associado;

  -- Liberar rastreador
  UPDATE rastreadores SET veiculo_id = NULL, associado_id = NULL, status = 'estoque' WHERE veiculo_id = v_veiculo OR associado_id = v_associado;

  -- Limpar referências de substituição
  UPDATE veiculos SET substituido_por = NULL WHERE substituido_por = v_veiculo;
  UPDATE cotacoes SET substituida_por_cotacao_id = NULL WHERE substituida_por_cotacao_id = ANY(v_cotacao_ids);
  UPDATE servicos SET novo_veiculo_id = NULL WHERE novo_veiculo_id = v_veiculo;
  UPDATE instalacoes SET agendamento_anterior_id = NULL WHERE agendamento_anterior_id = ANY(v_instalacao_ids);
  UPDATE cotacoes SET vistoria_id = NULL WHERE vistoria_id = ANY(v_vistoria_ids);
  UPDATE cotacoes SET contrato_gerado_id = NULL WHERE contrato_gerado_id = ANY(v_contrato_ids);
  UPDATE contratos SET vistoria_id = NULL WHERE vistoria_id = ANY(v_vistoria_ids);

  -- Filhos de vistoria/instalação
  DELETE FROM vistoria_fotos WHERE vistoria_id = ANY(v_vistoria_ids);
  DELETE FROM instalacao_fotos WHERE instalacao_id = ANY(v_instalacao_ids);
  DELETE FROM agendamentos_base WHERE vistoria_id = ANY(v_vistoria_ids) OR instalacao_id = ANY(v_instalacao_ids) OR cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM confirmacoes_agendamento WHERE instalacao_id = ANY(v_instalacao_ids);
  DELETE FROM instalacao_prestador_links WHERE instalacao_id = ANY(v_instalacao_ids);
  DELETE FROM vistoria_prestador_links WHERE instalacao_id = ANY(v_instalacao_ids);
  DELETE FROM ativacao_limbo_alertas WHERE instalacao_id = ANY(v_instalacao_ids);

  -- Cotação filhos
  DELETE FROM cotacoes_vistoria_fotos WHERE cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM cotacoes_historico WHERE cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM aprovacoes_fipe_menor WHERE cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM aprovacoes_fipe_diretoria WHERE cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM aprovacoes_elegibilidade WHERE cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM solicitacoes_migracao WHERE cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM solicitacoes_troca_titularidade WHERE cotacao_id = ANY(v_cotacao_ids) OR veiculo_id = v_veiculo;
  DELETE FROM solicitacoes_substituicao_placa WHERE cotacao_id = ANY(v_cotacao_ids) OR veiculo_antigo_id = v_veiculo;
  DELETE FROM auditoria_dia_vencimento_legado WHERE cotacao_id = ANY(v_cotacao_ids) OR contrato_id = ANY(v_contrato_ids);
  DELETE FROM instalacoes_pendentes_criacao WHERE cotacao_id = ANY(v_cotacao_ids) OR contrato_id = ANY(v_contrato_ids);

  -- Contrato filhos
  DELETE FROM contratos_documentos WHERE contrato_id = ANY(v_contrato_ids) OR cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM contratos_historico WHERE contrato_id = ANY(v_contrato_ids);
  DELETE FROM associados_historico WHERE contrato_id = ANY(v_contrato_ids) OR associado_id = v_associado OR instalacao_id = ANY(v_instalacao_ids) OR veiculo_id = v_veiculo;
  DELETE FROM documentos_solicitados WHERE contrato_id = ANY(v_contrato_ids);
  DELETE FROM gastos_beneficios WHERE contrato_id = ANY(v_contrato_ids);
  DELETE FROM cobrancas_composicao WHERE veiculo_id = v_veiculo;
  DELETE FROM cobrancas WHERE contrato_id = ANY(v_contrato_ids) OR associado_id = v_associado OR veiculo_id = v_veiculo;
  DELETE FROM asaas_cobrancas WHERE contrato_id = ANY(v_contrato_ids) OR associado_id = v_associado OR veiculo_id = v_veiculo;
  DELETE FROM asaas_pagamentos WHERE associado_id = v_associado;
  DELETE FROM asaas_clientes WHERE associado_id = v_associado;
  DELETE FROM comissoes_deducoes WHERE contrato_id = ANY(v_contrato_ids);
  DELETE FROM comissoes WHERE contrato_id = ANY(v_contrato_ids);
  DELETE FROM cc_vendedor_lancamentos WHERE contrato_id = ANY(v_contrato_ids);
  DELETE FROM pontuacao_eventos WHERE contrato_id = ANY(v_contrato_ids);
  DELETE FROM operacao_config_snapshot WHERE contrato_id = ANY(v_contrato_ids);
  DELETE FROM associados_beneficios_adicionais WHERE contrato_id = ANY(v_contrato_ids);
  DELETE FROM blacklist_veiculos WHERE contrato_id = ANY(v_contrato_ids) OR vistoria_id = ANY(v_vistoria_ids) OR veiculo_id = v_veiculo;
  DELETE FROM substituicoes_veiculo WHERE contrato_novo_id = ANY(v_contrato_ids) OR veiculo_novo_id = v_veiculo OR veiculo_antigo_id = v_veiculo;

  -- Veículo dependências
  DELETE FROM documentos WHERE veiculo_id = v_veiculo OR associado_id = v_associado;
  DELETE FROM chamados_assistencia WHERE veiculo_id = v_veiculo OR associado_id = v_associado;
  DELETE FROM sinistros WHERE veiculo_id = v_veiculo OR associado_id = v_associado;
  DELETE FROM sinistro_vidros_historico WHERE veiculo_id = v_veiculo;
  DELETE FROM ordens_servico WHERE veiculo_id = v_veiculo OR associado_id = v_associado;
  DELETE FROM rastreador_alertas WHERE veiculo_id = v_veiculo;
  DELETE FROM rastreadores_comandos WHERE veiculo_id = v_veiculo;
  DELETE FROM softruck_eventos WHERE veiculo_id = v_veiculo;
  DELETE FROM sga_sync_logs WHERE veiculo_id = v_veiculo;
  DELETE FROM sga_sync_queue WHERE veiculo_id = v_veiculo;
  DELETE FROM sga_sync_financeiro_jobs WHERE veiculo_id = v_veiculo;
  DELETE FROM acionamentos_roubo_furto WHERE veiculo_id = v_veiculo;
  DELETE FROM manutencao_tratativas WHERE veiculo_id = v_veiculo;
  DELETE FROM pagamentos_sga_historico WHERE veiculo_id = v_veiculo;
  DELETE FROM estoque_movimentacoes WHERE veiculo_id = v_veiculo OR instalacao_id = ANY(v_instalacao_ids);

  -- Serviços
  DELETE FROM servicos WHERE veiculo_id = v_veiculo OR contrato_id = ANY(v_contrato_ids) OR cotacao_id = ANY(v_cotacao_ids);

  -- Vistorias e instalações
  DELETE FROM vistorias WHERE id = ANY(v_vistoria_ids);
  DELETE FROM instalacoes WHERE id = ANY(v_instalacao_ids);

  -- Associado dependências adicionais
  DELETE FROM leads WHERE associado_id = v_associado OR cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM regua_execucoes WHERE associado_id = v_associado;
  DELETE FROM cobranca_contatos WHERE associado_id = v_associado;
  DELETE FROM acordos WHERE associado_id = v_associado;
  DELETE FROM negativacoes WHERE associado_id = v_associado;
  DELETE FROM cobranca_fila WHERE associado_id = v_associado;
  DELETE FROM processos WHERE associado_id = v_associado;
  DELETE FROM consultas_juridicas WHERE associado_id = v_associado;

  -- Contratos
  DELETE FROM contratos WHERE id = ANY(v_contrato_ids);

  -- Cotações
  DELETE FROM cotacoes WHERE id = ANY(v_cotacao_ids);

  -- Veículo e associado
  DELETE FROM veiculos WHERE id = v_veiculo;
  DELETE FROM associados WHERE id = v_associado;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM profiles WHERE user_id = v_user_id;
  END IF;
END $$;
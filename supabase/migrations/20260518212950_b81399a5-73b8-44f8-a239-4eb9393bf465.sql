DO $$
DECLARE
  v_ids uuid[] := ARRAY['988dbfa9-372f-4706-a84d-9275e647e00a'::uuid, '76831a73-71c2-4164-b678-00f4cda225d1'::uuid];
  v_cpfs text[] := ARRAY['12493649737','14194896742'];
  v_veic_ids uuid[];
  v_placas text[];
  v_contrato_ids uuid[];
  v_cotacao_ids uuid[];
  v_vistoria_ids uuid[];
  v_instalacao_ids uuid[];
  v_lead_ids uuid[];
BEGIN
  SELECT array_agg(id), array_agg(placa) INTO v_veic_ids, v_placas
    FROM veiculos WHERE associado_id = ANY(v_ids);
  v_veic_ids := COALESCE(v_veic_ids, ARRAY[]::uuid[]);
  v_placas   := COALESCE(v_placas, ARRAY[]::text[]);

  SELECT array_agg(id) INTO v_contrato_ids FROM contratos
    WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids);
  v_contrato_ids := COALESCE(v_contrato_ids, ARRAY[]::uuid[]);

  SELECT array_agg(id) INTO v_cotacao_ids FROM cotacoes
    WHERE contrato_gerado_id = ANY(v_contrato_ids)
       OR cliente_cpf = ANY(v_cpfs)
       OR veiculo_placa = ANY(v_placas);
  v_cotacao_ids := COALESCE(v_cotacao_ids, ARRAY[]::uuid[]);

  SELECT array_agg(id) INTO v_instalacao_ids FROM instalacoes
    WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids)
       OR contrato_id = ANY(v_contrato_ids) OR cotacao_id = ANY(v_cotacao_ids);
  v_instalacao_ids := COALESCE(v_instalacao_ids, ARRAY[]::uuid[]);

  SELECT array_agg(id) INTO v_vistoria_ids FROM vistorias
    WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids)
       OR contrato_id = ANY(v_contrato_ids) OR cotacao_id = ANY(v_cotacao_ids)
       OR instalacao_id = ANY(v_instalacao_ids);
  v_vistoria_ids := COALESCE(v_vistoria_ids, ARRAY[]::uuid[]);

  SELECT array_agg(id) INTO v_lead_ids FROM leads
    WHERE associado_id = ANY(v_ids) OR cotacao_id = ANY(v_cotacao_ids);
  v_lead_ids := COALESCE(v_lead_ids, ARRAY[]::uuid[]);

  -- ============ Rastreadores: volta para estoque ============
  UPDATE rastreadores
     SET veiculo_id = NULL, associado_id = NULL, status = 'estoque'
   WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids);

  -- ============ Limpeza de tabelas vinculadas ============
  -- Substituições (referenciam veículo antigo/novo e contratos)
  DELETE FROM substituicoes_veiculo
    WHERE associado_id = ANY(v_ids)
       OR veiculo_antigo_id = ANY(v_veic_ids) OR veiculo_novo_id = ANY(v_veic_ids)
       OR contrato_novo_id = ANY(v_contrato_ids);

  -- Solicitações de troca / substituição de placa / migração
  DELETE FROM solicitacoes_troca_titularidade
    WHERE veiculo_id = ANY(v_veic_ids)
       OR associado_antigo_id = ANY(v_ids) OR novo_associado_id = ANY(v_ids)
       OR cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM solicitacoes_substituicao_placa
    WHERE associado_id = ANY(v_ids) OR veiculo_antigo_id = ANY(v_veic_ids)
       OR cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM solicitacoes_migracao WHERE cotacao_id = ANY(v_cotacao_ids);

  -- Acordos, cobranças, financeiro
  DELETE FROM acordos WHERE associado_id = ANY(v_ids);
  DELETE FROM negativacoes WHERE associado_id = ANY(v_ids);
  DELETE FROM cobranca_eventos WHERE associado_id = ANY(v_ids);
  DELETE FROM cobranca_fila WHERE associado_id = ANY(v_ids);
  DELETE FROM cobranca_contatos WHERE associado_id = ANY(v_ids);
  DELETE FROM cobranca_csv_boletos WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids);
  DELETE FROM cobrancas_composicao WHERE veiculo_id = ANY(v_veic_ids);
  DELETE FROM cobrancas WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids) OR contrato_id = ANY(v_contrato_ids);
  DELETE FROM asaas_cobrancas WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids) OR contrato_id = ANY(v_contrato_ids);
  DELETE FROM asaas_pagamentos WHERE associado_id = ANY(v_ids);
  DELETE FROM asaas_clientes WHERE associado_id = ANY(v_ids);
  DELETE FROM pagamentos_sga_historico WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids);
  DELETE FROM regua_execucoes WHERE associado_id = ANY(v_ids);

  -- Comissões, vendas, leads
  DELETE FROM cc_vendedor_lancamentos WHERE associado_id = ANY(v_ids) OR contrato_id = ANY(v_contrato_ids);
  DELETE FROM comissoes_deducoes WHERE associado_id = ANY(v_ids) OR contrato_id = ANY(v_contrato_ids);
  DELETE FROM comissoes WHERE associado_id = ANY(v_ids) OR contrato_id = ANY(v_contrato_ids);
  DELETE FROM pontuacao_eventos WHERE contrato_id = ANY(v_contrato_ids);
  DELETE FROM indicacoes WHERE associado_id = ANY(v_ids) OR indicador_id = ANY(v_ids);
  DELETE FROM leads WHERE id = ANY(v_lead_ids);

  -- Jurídico / processos / pesquisas
  DELETE FROM consultas_juridicas WHERE associado_id = ANY(v_ids);
  DELETE FROM processos WHERE associado_id = ANY(v_ids);
  DELETE FROM pesquisas_antecedentes WHERE associado_id = ANY(v_ids);
  DELETE FROM ouvidoria_manifestacoes WHERE associado_id = ANY(v_ids);

  -- Sinistros & assistência
  DELETE FROM sinistro_vidros_historico WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids);
  DELETE FROM acionamentos_roubo_furto WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids);
  DELETE FROM chamados_assistencia WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids);
  DELETE FROM sinistros WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids);

  -- Oficinas / manutenção / ordens
  DELETE FROM ordens_servico WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids);
  DELETE FROM manutencao_tratativas WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids);

  -- Rastreadores: alertas/comandos/eventos/estoque
  DELETE FROM rastreador_alertas WHERE veiculo_id = ANY(v_veic_ids);
  DELETE FROM rastreadores_comandos WHERE veiculo_id = ANY(v_veic_ids);
  DELETE FROM softruck_eventos WHERE veiculo_id = ANY(v_veic_ids);
  DELETE FROM estoque_movimentacoes WHERE veiculo_id = ANY(v_veic_ids) OR instalacao_id = ANY(v_instalacao_ids);

  -- Blacklist e auditorias
  DELETE FROM blacklist_veiculos WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids)
       OR contrato_id = ANY(v_contrato_ids) OR vistoria_id = ANY(v_vistoria_ids);
  UPDATE auditoria_dia_vencimento_legado SET associado_id = NULL WHERE associado_id = ANY(v_ids);
  UPDATE auditoria_dia_vencimento_legado SET contrato_id = NULL WHERE contrato_id = ANY(v_contrato_ids);
  UPDATE auditoria_dia_vencimento_legado SET cotacao_id = NULL WHERE cotacao_id = ANY(v_cotacao_ids);

  -- SGA / sync
  DELETE FROM sga_reconciliacao_veiculo_jobs WHERE associado_id = ANY(v_ids);
  DELETE FROM sga_situacao_check WHERE associado_id = ANY(v_ids) OR contrato_id = ANY(v_contrato_ids);
  UPDATE sga_sync_financeiro_jobs SET associado_id = NULL WHERE associado_id = ANY(v_ids);
  UPDATE sga_sync_financeiro_jobs SET veiculo_id = NULL WHERE veiculo_id = ANY(v_veic_ids);
  UPDATE sga_sync_logs SET associado_id = NULL WHERE associado_id = ANY(v_ids);
  UPDATE sga_sync_logs SET veiculo_id = NULL WHERE veiculo_id = ANY(v_veic_ids);
  DELETE FROM sga_sync_queue WHERE associado_id = ANY(v_ids);
  UPDATE relacionamento_debitos_pendentes SET associado_id = NULL WHERE associado_id = ANY(v_ids);
  UPDATE cotacao_avisos_sga SET associado_id = NULL WHERE associado_id = ANY(v_ids);
  DELETE FROM cotacao_avisos_sga WHERE cotacao_id = ANY(v_cotacao_ids) OR contrato_id = ANY(v_contrato_ids);

  -- Beneficios / gastos / docs / chat
  DELETE FROM associados_beneficios_adicionais WHERE associado_id = ANY(v_ids) OR contrato_id = ANY(v_contrato_ids);
  DELETE FROM gastos_beneficios WHERE associado_id = ANY(v_ids) OR contrato_id = ANY(v_contrato_ids);
  DELETE FROM documentos_solicitados WHERE associado_id = ANY(v_ids) OR contrato_id = ANY(v_contrato_ids);
  DELETE FROM documento_gerados WHERE associado_id = ANY(v_ids);
  DELETE FROM documentos WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids);
  DELETE FROM chat_mensagens_ia WHERE associado_id = ANY(v_ids);
  DELETE FROM chat_solicitacoes_ia WHERE associado_id = ANY(v_ids);
  DELETE FROM auth_tokens_app WHERE associado_id = ANY(v_ids);
  DELETE FROM auth_tokens_primeiro_acesso WHERE associado_id = ANY(v_ids);
  DELETE FROM rastreador_preferencias WHERE associado_id = ANY(v_ids);
  DELETE FROM operacao_config_snapshot WHERE associado_id = ANY(v_ids) OR contrato_id = ANY(v_contrato_ids);
  DELETE FROM ativacao_limbo_alertas WHERE associado_id = ANY(v_ids) OR instalacao_id = ANY(v_instalacao_ids);
  DELETE FROM associados_historico WHERE associado_id = ANY(v_ids);

  -- Aprovações / contratos histórico / cotações histórico
  DELETE FROM aprovacoes_elegibilidade WHERE cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM aprovacoes_fipe_diretoria WHERE cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM aprovacoes_fipe_menor WHERE cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM contratos_documentos WHERE contrato_id = ANY(v_contrato_ids) OR cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM contratos_historico WHERE contrato_id = ANY(v_contrato_ids);
  DELETE FROM cotacoes_historico WHERE cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM cotacoes_vistoria_fotos WHERE cotacao_id = ANY(v_cotacao_ids);

  -- Instalações / vistorias / agendamentos / serviços
  DELETE FROM instalacao_fotos WHERE instalacao_id = ANY(v_instalacao_ids);
  DELETE FROM instalacao_prestador_links WHERE instalacao_id = ANY(v_instalacao_ids);
  DELETE FROM vistoria_prestador_links WHERE instalacao_id = ANY(v_instalacao_ids) OR vistoria_id = ANY(v_vistoria_ids);
  DELETE FROM confirmacoes_agendamento WHERE instalacao_id = ANY(v_instalacao_ids);
  DELETE FROM agendamentos_base WHERE cotacao_id = ANY(v_cotacao_ids) OR instalacao_id = ANY(v_instalacao_ids) OR vistoria_id = ANY(v_vistoria_ids);
  DELETE FROM vistoria_fotos WHERE vistoria_id = ANY(v_vistoria_ids);
  UPDATE servicos SET vistoria_origem_id = NULL WHERE vistoria_origem_id = ANY(v_vistoria_ids);
  UPDATE servicos SET instalacao_origem_id = NULL WHERE instalacao_origem_id = ANY(v_instalacao_ids);
  DELETE FROM servicos
    WHERE associado_id = ANY(v_ids) OR veiculo_id = ANY(v_veic_ids) OR novo_veiculo_id = ANY(v_veic_ids)
       OR contrato_id = ANY(v_contrato_ids) OR cotacao_id = ANY(v_cotacao_ids);
  UPDATE contratos SET vistoria_id = NULL WHERE vistoria_id = ANY(v_vistoria_ids);
  UPDATE cotacoes  SET vistoria_id = NULL WHERE vistoria_id = ANY(v_vistoria_ids);
  DELETE FROM vistorias WHERE id = ANY(v_vistoria_ids);
  UPDATE instalacoes SET agendamento_anterior_id = NULL WHERE agendamento_anterior_id = ANY(v_instalacao_ids);
  DELETE FROM instalacoes_pendentes_criacao WHERE contrato_id = ANY(v_contrato_ids) OR cotacao_id = ANY(v_cotacao_ids);
  DELETE FROM instalacoes WHERE id = ANY(v_instalacao_ids);

  -- Cotações que foram substituídas por outras (NO ACTION self-fk)
  UPDATE cotacoes SET substituida_por_cotacao_id = NULL WHERE substituida_por_cotacao_id = ANY(v_cotacao_ids);

  -- Contratos / cotações / veículos / associados
  UPDATE associados SET contrato_id = NULL WHERE contrato_id = ANY(v_contrato_ids);
  DELETE FROM cotacoes WHERE id = ANY(v_cotacao_ids);
  DELETE FROM contratos WHERE id = ANY(v_contrato_ids);
  UPDATE veiculos SET substituido_por = NULL WHERE substituido_por = ANY(v_veic_ids);
  DELETE FROM veiculos WHERE id = ANY(v_veic_ids);
  DELETE FROM associados WHERE id = ANY(v_ids);
END $$;
DO $$
DECLARE
  v_rastreador_id uuid := '7a4b13ab-da6c-4e8f-ab7e-38b8803d8fdb';
  v_imei text := '869412072526525';
  v_veic_tum uuid := '55c2f9bc-9c16-4e63-a838-d2fbe143d5aa';
  v_veic_kpx uuid := 'cb53e6bc-9280-45e7-82a9-eabc74e49bb1';
  v_assoc_edgar uuid := '4326b0f4-ba90-49fb-ad98-e58e3e298fbe';
  v_assoc_pedro uuid := '8f612b82-923d-425d-933a-7896ea5f7dfd';
  v_contrato uuid := 'ea3fe292-0967-44fe-b953-0bd6fb933a49';
  v_vistoria uuid := '79b80d0e-e31a-4fd1-8bc8-b15bd116d633';
  v_inst_id uuid := gen_random_uuid();
  v_op uuid := '37beadcf-284b-4a2c-88a0-6efa8cae60d9';
  v_op_nome text := 'sistema-saneamento (admin@teste.com)';
BEGIN
  UPDATE public.rastreadores SET veiculo_id=NULL, associado_id=NULL, status='instalado', updated_at=now() WHERE id=v_rastreador_id;
  UPDATE public.rastreadores SET veiculo_id=v_veic_tum, associado_id=v_assoc_edgar, status='instalado', updated_at=now() WHERE id=v_rastreador_id;

  UPDATE public.contratos SET cadastro_aprovado=true, aprovado_em=now(), aprovado_por=NULL WHERE id=v_contrato;

  INSERT INTO public.instalacoes (
    id, veiculo_id, contrato_id, rastreador_id, imei_rastreador,
    status, data_agendada, concluida_em, dispensa_rastreador, observacoes, created_at, updated_at
  ) VALUES (
    v_inst_id, v_veic_tum, v_contrato, v_rastreador_id, v_imei,
    'concluida', CURRENT_DATE, now(), false,
    'Saneamento dessincronia Softruck<->banco: rastreador IMEI 869412072526525 ja estava fisicamente instalado no TUM3D59 (confirmado pela Softruck). Vinculo migrado de KPX3F78 (associado anterior migrou para KPQ8J26).',
    now(), now()
  );

  UPDATE public.vistorias SET instalacao_id=v_inst_id, updated_at=now() WHERE id=v_vistoria;
  UPDATE public.veiculos SET status='instalacao_pendente', cobertura_total=false, updated_at=now() WHERE id=v_veic_tum;
  UPDATE public.associados SET status='aguardando_instalacao', updated_at=now() WHERE id=v_assoc_edgar;

  INSERT INTO public.logs_auditoria (usuario_id, usuario_nome, acao, modulo, descricao, tabela, registro_id, dados_anteriores, dados_novos) VALUES
  (v_op, v_op_nome, 'editar', 'monitoramento',
    'Saneamento Softruck<->banco: rastreador IMEI 869412072526525 desvinculado de KPX3F78 (PEDRO LUCCAS migrou para KPQ8J26 com rastreador proprio). Equipamento permanece instalado fisicamente; vinculo reapontado para TUM3D59.',
    'rastreadores', v_rastreador_id,
    jsonb_build_object('veiculo_id', v_veic_kpx, 'associado_id', v_assoc_pedro),
    jsonb_build_object('veiculo_id', NULL, 'associado_id', NULL, 'motivo', 'dessincronia_softruck_kpx3f78')),
  (v_op, v_op_nome, 'editar', 'monitoramento',
    'Saneamento Softruck<->banco: rastreador IMEI 869412072526525 vinculado ao TUM3D59 (EDGAR DA SILVA SANTOS). Fonte da verdade: Softruck.',
    'rastreadores', v_rastreador_id, NULL,
    jsonb_build_object('veiculo_id', v_veic_tum, 'associado_id', v_assoc_edgar, 'motivo', 'reconciliacao_tum3d59')),
  (v_op, v_op_nome, 'criar', 'instalacoes',
    'Saneamento Softruck<->banco: instalacao concluida materializada para TUM3D59. Vistoria presencial 79b80d0e-e31a-4fd1-8bc8-b15bd116d633 amarrada a esta instalacao.',
    'instalacoes', v_inst_id, NULL,
    jsonb_build_object('motivo', 'saneamento_dessincronia', 'imei', v_imei, 'rastreador_id', v_rastreador_id)),
  (v_op, v_op_nome, 'editar', 'monitoramento',
    'Saneamento Softruck<->banco: TUM3D59 devolvido a instalacao_pendente para passar pela Aprovacao canonica do Monitoramento (ativacao final via ativar-associado).',
    'veiculos', v_veic_tum,
    jsonb_build_object('status', 'ativo'),
    jsonb_build_object('status', 'instalacao_pendente', 'cobertura_total', false)),
  (v_op, v_op_nome, 'editar', 'monitoramento',
    'Saneamento Softruck<->banco: EDGAR DA SILVA SANTOS voltou para aguardando_instalacao para entrar na fila do Monitoramento.',
    'associados', v_assoc_edgar,
    jsonb_build_object('status', 'em_analise'),
    jsonb_build_object('status', 'aguardando_instalacao')),
  (v_op, v_op_nome, 'aprovar', 'contratos',
    'Cadastro aprovado programaticamente por reconciliacao Softruck<->banco. Justificativa material: vistoria presencial 79b80d0e-e31a-4fd1-8bc8-b15bd116d633 realizada em 22/04/2026 por Wallace Nunes, status=aprovada. Rastreador fisico 869412072526525 confirmado instalado pela Softruck. Caso estava parado no Cadastro apenas pelo conflito de IMEI orfao (KPX3F78), corrigido neste saneamento.',
    'contratos', v_contrato,
    jsonb_build_object('cadastro_aprovado', false, 'aprovado_em', NULL),
    jsonb_build_object('cadastro_aprovado', true, 'aprovado_em', now(), 'justificativa_vistoria_id', v_vistoria, 'atendente_vistoria', 'Wallace Nunes', 'data_vistoria', '2026-04-22'));
END $$;
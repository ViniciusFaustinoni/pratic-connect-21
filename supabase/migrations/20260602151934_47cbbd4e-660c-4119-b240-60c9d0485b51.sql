DO $$
DECLARE
  v_cotacao_id    uuid := '4fac234b-43cb-44bf-89c7-df6e48bcfc55';
  v_contrato_id   uuid := 'ae786fe0-07a6-4a57-8234-3a39fc9fffe0';
  v_associado_id  uuid := '3ec9e32a-9287-49d9-9d9d-38f512151b33';
  v_veiculo_id    uuid := 'dbf6aafe-a626-4049-af4d-1a5525aca026';
  v_vistoria_id   uuid;
  v_servico_id    uuid;
  v_count         int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.logs_auditoria
   WHERE tabela='cotacoes' AND registro_id=v_cotacao_id
     AND descricao LIKE '[autovistoria_perdida_convertida_presencial]%';
  IF v_count > 0 THEN
    RAISE NOTICE 'Cotacao % ja convertida.', v_cotacao_id;
    RETURN;
  END IF;

  UPDATE public.cotacoes
     SET tipo_vistoria='agendada', vistoria_concluida_em=NULL, updated_at=now()
   WHERE id=v_cotacao_id;

  INSERT INTO public.vistorias (
    associado_id, veiculo_id, contrato_id, cotacao_id,
    tipo, status, modalidade, observacoes, origem, created_at, updated_at
  ) VALUES (
    v_associado_id, v_veiculo_id, v_contrato_id, v_cotacao_id,
    'entrada'::tipo_vistoria, 'pendente'::status_vistoria, 'presencial',
    '[autovistoria_perdida_convertida_presencial] storage zerado; tecnico fara as fotos no local',
    'conversao_autovistoria_perdida', now(), now()
  ) RETURNING id INTO v_vistoria_id;

  INSERT INTO public.agendamentos_base (
    data_agendada, horario, vistoria_id, cotacao_id,
    cliente_nome, cliente_telefone, cliente_email,
    veiculo_placa, veiculo_descricao, status, observacoes, created_at, updated_at
  ) VALUES (
    CURRENT_DATE, '09:00'::time, v_vistoria_id, v_cotacao_id,
    'ELISABETE PEREIRA SERQUEIRA', '21975771033', 'michelleserqueira.mp@gmail.com',
    'LLD9569', 'Fiat SIENA 1.0/ EX 1.0 MPI FIRE/ FIRE FLEX 8V',
    'agendado',
    'Conversao presencial - autovistoria perdida (upload zerado, 0 fotos no storage)',
    now(), now()
  );

  SELECT id INTO v_servico_id
    FROM public.servicos WHERE vistoria_origem_id=v_vistoria_id LIMIT 1;
  IF v_servico_id IS NULL THEN
    RAISE EXCEPTION 'Trigger nao materializou servico para vistoria %', v_vistoria_id;
  END IF;

  INSERT INTO public.logs_auditoria (
    acao, modulo, tabela, registro_id, descricao, dados_novos, created_at
  ) VALUES (
    'criar', 'vistoria', 'cotacoes', v_cotacao_id,
    '[autovistoria_perdida_convertida_presencial] motivo=storage_zerado upload_silenciosamente_falhou veiculo=LLD9569 fipe=27315 associado=ELISABETE',
    jsonb_build_object(
      'cotacao_id', v_cotacao_id, 'contrato_id', v_contrato_id,
      'vistoria_id', v_vistoria_id, 'servico_id', v_servico_id,
      'tipo_vistoria_novo', 'agendada',
      'caminho', 'agendamentos_base->trg_agendamento_base_materializa_servico'
    ),
    now()
  );

  RAISE NOTICE 'OK Elisabete: vistoria=%, servico=%', v_vistoria_id, v_servico_id;
END $$;
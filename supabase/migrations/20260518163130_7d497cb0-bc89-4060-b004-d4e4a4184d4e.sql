
DO $$
DECLARE
  v_rastreador_id uuid := '6845fe77-8875-429a-bd5f-eec0539d6344';
  v_veiculo_id    uuid := '34051e8c-6df6-42d9-baf3-b6b9b4e9ed4e';
  v_contrato_id   uuid := '8455c419-1473-47a1-aff6-74309d1d0346';
  v_cotacao_id    uuid := '306dd82b-54f6-4918-8c3b-046690100188';
  v_associado_id  uuid := '7840efc0-9740-4bac-99c0-e076517008e3';
  v_imei          text := '865209074423352';
  v_inst_id       uuid;
  v_existing      uuid;
BEGIN
  -- Idempotência
  SELECT id INTO v_existing FROM public.instalacoes
   WHERE contrato_id=v_contrato_id AND rastreador_id=v_rastreador_id AND status='concluida' LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE NOTICE 'Reprocessamento já aplicado: instalacao %', v_existing;
    RETURN;
  END IF;

  -- 1) Vincular rastreador
  UPDATE public.rastreadores
     SET veiculo_id=v_veiculo_id,
         associado_id=v_associado_id,
         status='instalado',
         updated_at=now(),
         dados_extras = COALESCE(dados_extras,'{}'::jsonb) || jsonb_build_object(
           'reprocessamento_manual', jsonb_build_object(
             'em', now(),
             'motivo', 'Instalação física confirmada em campo 18/05/2026',
             'placa', 'LMF8I79',
             'contrato_id', v_contrato_id
           ))
   WHERE id=v_rastreador_id
     AND (veiculo_id IS NULL OR veiculo_id=v_veiculo_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rastreador % indisponível para vínculo', v_rastreador_id;
  END IF;

  -- 2) Materializar instalação concluída
  INSERT INTO public.instalacoes (
    associado_id, veiculo_id, contrato_id, cotacao_id,
    rastreador_id, imei_rastreador,
    data_agendada, data_agendada_original, periodo,
    status, iniciada_em, concluida_em,
    observacoes, historico_datas, dispensa_rastreador,
    local_vistoria, permite_encaixe
  ) VALUES (
    v_associado_id, v_veiculo_id, v_contrato_id, v_cotacao_id,
    v_rastreador_id, v_imei,
    CURRENT_DATE, CURRENT_DATE, 'tarde',
    'concluida', now(), now(),
    'Reprocessamento manual 18/05/2026 — instalação física confirmada com rastreador Softruck IMEI '||v_imei||'.',
    '[]'::jsonb, false,
    'cliente', false
  )
  RETURNING id INTO v_inst_id;

  -- 3) Serviço vistoria_entrada concluido espelhando a instalação
  INSERT INTO public.servicos (
    associado_id, veiculo_id, contrato_id,
    tipo, status, modalidade, local_vistoria, periodo,
    data_agendada, rastreador_id, imei_rastreador,
    iniciada_em, concluida_em, instalacao_origem_id,
    observacoes, historico_datas, permite_encaixe, etapa_atual
  ) VALUES (
    v_associado_id, v_veiculo_id, v_contrato_id,
    'vistoria_entrada', 'concluida', 'presencial', 'cliente', 'tarde',
    CURRENT_DATE, v_rastreador_id, v_imei,
    now(), now(), v_inst_id,
    'Reprocessamento manual 18/05/2026 — instalação concluída com rastreador '||v_imei||'.',
    '[]'::jsonb, false, 1
  );

  RAISE NOTICE 'Reprocessamento aplicado para contrato % com instalacao %', v_contrato_id, v_inst_id;
END $$;

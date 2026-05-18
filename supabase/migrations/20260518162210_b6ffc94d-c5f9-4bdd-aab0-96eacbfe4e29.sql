
DO $$
DECLARE
  v_rastreador_id uuid := '0e3e192e-06f6-4c2c-ac9b-9f35b7c36447';
  v_veiculo_id    uuid := '23a2bfb7-ba54-46c5-9395-cbf1deac57b3';
  v_contrato_id   uuid := '1dca5199-cc1c-4187-8bb0-9a20889dbf28';
  v_cotacao_id    uuid := '9b199c6f-ead5-4efd-967c-8d3e07533c4e';
  v_associado_id  uuid := '72ca27f8-6b74-4d17-bf8d-d58045b8bb7f';
  v_servico_id    uuid := '4ae1c7ab-85ff-4d39-a331-6478b6a48cd1';
  v_existing_inst uuid;
BEGIN
  -- Guard idempotência: já existe instalação concluída com este rastreador?
  SELECT id INTO v_existing_inst
  FROM public.instalacoes
  WHERE contrato_id = v_contrato_id
    AND rastreador_id = v_rastreador_id
    AND status = 'concluida'
  LIMIT 1;

  IF v_existing_inst IS NOT NULL THEN
    RAISE NOTICE 'Reprocessamento já aplicado: instalacao %', v_existing_inst;
    RETURN;
  END IF;

  -- 1) Vincular rastreador ao veículo/associado
  UPDATE public.rastreadores
  SET veiculo_id    = v_veiculo_id,
      associado_id  = v_associado_id,
      status        = 'instalado',
      updated_at    = now(),
      dados_extras  = COALESCE(dados_extras, '{}'::jsonb) || jsonb_build_object(
        'reprocessamento_manual', jsonb_build_object(
          'em', now(),
          'motivo', 'Instalação física confirmada em campo 18/05/2026',
          'placa', 'KOA4D63',
          'contrato_id', v_contrato_id
        )
      )
  WHERE id = v_rastreador_id
    AND (veiculo_id IS NULL OR veiculo_id = v_veiculo_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rastreador % indisponível para vínculo (já em outro veículo?)', v_rastreador_id;
  END IF;

  -- 2) Materializar instalação concluída (espelhando o serviço vistoria_entrada de hoje)
  INSERT INTO public.instalacoes (
    associado_id, veiculo_id, contrato_id, cotacao_id,
    rastreador_id, imei_rastreador,
    data_agendada, data_agendada_original, periodo,
    cep, logradouro, numero, bairro, cidade, uf,
    status, iniciada_em, concluida_em,
    observacoes, historico_datas, dispensa_rastreador,
    local_vistoria, permite_encaixe
  )
  SELECT
    v_associado_id, v_veiculo_id, v_contrato_id, v_cotacao_id,
    v_rastreador_id, '868018075119845',
    CURRENT_DATE, CURRENT_DATE, 'tarde',
    c.vistoria_completa_endereco_cep,
    c.vistoria_completa_endereco_logradouro,
    c.vistoria_completa_endereco_numero,
    c.vistoria_completa_endereco_bairro,
    c.vistoria_completa_endereco_cidade,
    c.vistoria_completa_endereco_estado,
    'concluida', now(), now(),
    'Reprocessamento manual 18/05/2026 — instalação física confirmada com rastreador Softruck IMEI 868018075119845. Serviço de origem: ' || v_servico_id::text,
    '[]'::jsonb, false,
    'cliente', false
  FROM public.cotacoes c WHERE c.id = v_cotacao_id;

  -- 3) Fechar o serviço vistoria_entrada vivo
  UPDATE public.servicos
  SET status        = 'concluida',
      rastreador_id = v_rastreador_id,
      imei_rastreador = '868018075119845',
      iniciada_em   = COALESCE(iniciada_em, now()),
      concluida_em  = now(),
      observacoes   = COALESCE(observacoes, '') ||
        E'\n[Reprocessamento manual 18/05/2026] Instalação física confirmada em campo com rastreador 868018075119845.',
      updated_at    = now()
  WHERE id = v_servico_id
    AND status <> 'concluida';

  RAISE NOTICE 'Reprocessamento aplicado com sucesso para contrato %', v_contrato_id;
END $$;

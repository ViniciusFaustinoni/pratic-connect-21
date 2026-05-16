DO $$
DECLARE
  v_cotacao_id uuid := '2310279e-851a-4787-872e-5d2a9cb0a832';
  v_contrato_id uuid := '0cf41fac-575d-472e-b6ab-9fe24f7b849b';
  v_veiculo_id uuid := '7ac21719-4701-4cee-a830-0faf5a665c02';
  v_associado_id uuid := 'a380b228-32e1-4f9e-9a28-a749a373e03c';
  v_cot RECORD;
  v_assoc RECORD;
  v_inst_existente uuid;
  v_nova_instalacao_id uuid;
  v_periodo text;
BEGIN
  SELECT id INTO v_inst_existente
  FROM public.instalacoes
  WHERE cotacao_id = v_cotacao_id
    AND veiculo_id = v_veiculo_id
    AND status IN ('agendada','em_andamento','em_analise','concluida')
  LIMIT 1;

  IF v_inst_existente IS NOT NULL THEN
    RAISE NOTICE 'Instalação já existe (%); backfill ignorado.', v_inst_existente;
    RETURN;
  END IF;

  SELECT * INTO v_cot FROM public.cotacoes WHERE id = v_cotacao_id;

  IF v_cot.vistoria_completa_data_agendada IS NULL THEN
    RAISE NOTICE 'Cotação sem data agendada; nada a materializar.';
    RETURN;
  END IF;

  SELECT logradouro, numero, bairro, cidade, uf, cep
  INTO v_assoc FROM public.associados WHERE id = v_associado_id;

  v_periodo := COALESCE(v_cot.vistoria_completa_periodo, v_cot.vistoria_completa_horario_agendado, 'manha');
  IF v_periodo NOT IN ('manha','tarde') THEN v_periodo := 'manha'; END IF;

  INSERT INTO public.instalacoes (
    associado_id, veiculo_id, contrato_id, cotacao_id,
    status, data_agendada, periodo,
    logradouro, numero, bairro, cidade, uf, cep,
    local_vistoria, permite_encaixe, dispensa_rastreador
  ) VALUES (
    v_associado_id, v_veiculo_id, v_contrato_id, v_cotacao_id,
    'agendada',
    v_cot.vistoria_completa_data_agendada,
    v_periodo::periodo_instalacao,
    COALESCE(v_cot.vistoria_completa_endereco_logradouro, v_assoc.logradouro),
    COALESCE(v_cot.vistoria_completa_endereco_numero, v_assoc.numero),
    COALESCE(v_cot.vistoria_completa_endereco_bairro, v_assoc.bairro),
    COALESCE(v_cot.vistoria_completa_endereco_cidade, v_assoc.cidade),
    COALESCE(v_cot.vistoria_completa_endereco_estado, v_assoc.uf),
    COALESCE(v_cot.vistoria_completa_endereco_cep, v_assoc.cep),
    'cliente',
    COALESCE(v_cot.vistoria_permite_encaixe, false),
    false
  )
  RETURNING id INTO v_nova_instalacao_id;

  INSERT INTO public.logs_auditoria (acao, tabela, registro_id, descricao, dados_novos)
  VALUES (
    'criar',
    'instalacoes',
    v_nova_instalacao_id,
    'Backfill: materialização da instalação faltante (COT-20260516-101252395-551). Gate cadastroAprovado removido nesta release.',
    jsonb_build_object(
      'cotacao_id', v_cotacao_id,
      'contrato_id', v_contrato_id,
      'veiculo_id', v_veiculo_id,
      'data_agendada', v_cot.vistoria_completa_data_agendada
    )
  );

  RAISE NOTICE 'Instalação materializada: %', v_nova_instalacao_id;
END $$;
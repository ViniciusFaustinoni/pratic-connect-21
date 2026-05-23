DO $$
DECLARE
  v_cotacao_id uuid := 'a9960f90-2430-4bf0-88eb-675c593261f2';
  v_contrato_id uuid := '35f6d01c-30e6-49da-9cf4-4d211935f197';
  v_veiculo_id uuid := 'ec0039cc-8803-4968-8c5e-7dc67480586f';
  v_associado_id uuid := '92c39f2c-2957-4989-b78c-a056e1b99ebd';
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM public.instalacoes
   WHERE cotacao_id = v_cotacao_id OR contrato_id = v_contrato_id
   LIMIT 1;

  IF v_existing IS NULL THEN
    INSERT INTO public.instalacoes (
      associado_id, veiculo_id, contrato_id, cotacao_id,
      data_agendada, periodo,
      cep, logradouro, numero, bairro, cidade, uf,
      status, local_vistoria, permite_encaixe,
      dispensa_rastreador,
      observacoes
    ) VALUES (
      v_associado_id, v_veiculo_id, v_contrato_id, v_cotacao_id,
      '2026-05-25', 'manha'::periodo_instalacao,
      '25060280', 'RUA JOÃO ALVES TORRES FILHO', '4858',
      'VILA LEOPOLDINA', 'DUQUE DE CAXIAS', 'RJ',
      'agendada'::status_instalacao, 'cliente', true,
      false,
      'Materializada manualmente — agendamento original do link público preservado (correção pós-fix regex fn_veiculo_precisa_rastreador).'
    );
  END IF;

  UPDATE public.cotacoes
     SET status_contratacao = 'aguardando_instalacao',
         updated_at = now()
   WHERE id = v_cotacao_id
     AND status_contratacao = 'pagamento_ok';
END $$;
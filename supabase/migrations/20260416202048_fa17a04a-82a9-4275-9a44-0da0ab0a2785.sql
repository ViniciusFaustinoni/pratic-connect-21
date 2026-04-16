DO $$
DECLARE
  v_associado_id uuid := '7f04455c-30fa-4032-a088-4d404a4e9ead';
  v_contrato_id uuid := 'fd449610-7131-4ff2-8e08-e3672731917a';
  v_veiculo_id uuid;
  v_existing_veiculo uuid;
  v_placeholder_placa text;
BEGIN
  SELECT id INTO v_existing_veiculo
  FROM public.veiculos
  WHERE associado_id = v_associado_id
  LIMIT 1;

  IF v_existing_veiculo IS NOT NULL THEN
    v_veiculo_id := v_existing_veiculo;
    RAISE NOTICE 'Kelly já tinha veículo: %', v_veiculo_id;
  ELSE
    -- Placa placeholder para 0km (formato reconhecível e único)
    v_placeholder_placa := '0KM' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 5));

    INSERT INTO public.veiculos (
      associado_id, placa, marca, modelo,
      ano_fabricacao, ano_modelo, cor, combustivel,
      valor_fipe, chassi, renavam, status,
      cobertura_roubo_furto, cobertura_total
    ) VALUES (
      v_associado_id,
      v_placeholder_placa,
      'Renault',
      'KWID Zen 1.0 Flex 12V 5p Mec.',
      2017,
      2018,
      'BRANCA',
      'ALCOOL/GASOLINA',
      36136.00,
      '93YRBB002JJ007217',
      '01130834902',
      'em_analise',
      false,
      false
    )
    RETURNING id INTO v_veiculo_id;

    RAISE NOTICE 'Veículo criado para Kelly: % (placa placeholder: %)', v_veiculo_id, v_placeholder_placa;
  END IF;

  UPDATE public.contratos
  SET veiculo_id = v_veiculo_id
  WHERE id = v_contrato_id AND veiculo_id IS NULL;
END $$;
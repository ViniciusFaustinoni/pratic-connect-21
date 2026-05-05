
DO $$
DECLARE
  v_user_id uuid := '7f14d918-beae-4d69-b92e-c9d6d633e47d';
  v_plano_id uuid := '2e7bd600-9f25-4299-817a-c1cb8c143219';
  v_vendedor_id uuid := 'a92ea3c9-defd-420e-9d08-20e2fe5c46fc';
  v_assoc_id uuid;
  v_veic_id uuid;
  v_contrato_id uuid;
BEGIN
  -- Associado
  INSERT INTO public.associados (
    user_id, nome, cpf, rg, data_nascimento, email, telefone, whatsapp,
    cep, logradouro, numero, complemento, bairro, cidade, uf,
    plano_id, status, dia_vencimento, data_adesao,
    cnh_numero, vendedor_original_id, origem_cadastro
  ) VALUES (
    v_user_id,
    'THATYANE CHRYSTYNE DE MORAES PENA',
    '14219916750',
    '235680675',
    '1992-04-13',
    'chrysty_moraes03@hotmail.com',
    '21999744711',
    '21999744711',
    '20735230','R PAULO SILVA ARAUJO','194','FT','MEIER','RIO DE JANEIRO','RJ',
    v_plano_id,
    'aguardando_instalacao'::status_associado,
    25,
    '2026-04-22',
    '07261771742',
    v_vendedor_id,
    'restauracao_manual'
  ) RETURNING id INTO v_assoc_id;

  -- Veiculo
  INSERT INTO public.veiculos (
    associado_id, placa, chassi, renavam, marca, modelo,
    ano_fabricacao, ano_modelo, cor, combustivel, valor_fipe, valor_fipe_protegido,
    codigo_fipe, ativo, status, uso_aplicativo, principal
  ) VALUES (
    v_assoc_id, 'RUP6G12', '9BGEP76B0PB143911', '01304248957',
    'Chevrolet','tracker A Premier',
    2022, 2023, 'PRETA','ALCOOL/GASOLINA',
    109367.00, 109367.00,
    '004525-0', true, 'instalacao_pendente'::status_veiculo, true, true
  ) RETURNING id INTO v_veic_id;

  -- Contrato
  INSERT INTO public.contratos (
    numero, plano_id, associado_id, veiculo_id, vendedor_id,
    valor_adesao, valor_mensal, dia_vencimento,
    status, autentique_status,
    autentique_documento_id,
    data_envio, data_visualizacao, data_assinatura,
    cliente_nome, cliente_cpf, cliente_email, cliente_telefone,
    cliente_endereco, cliente_cep, cliente_cidade, cliente_uf,
    cliente_logradouro, cliente_numero, cliente_bairro, cliente_complemento,
    cliente_rg, cliente_cnh, cliente_data_nascimento,
    veiculo_placa, veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_cor,
    veiculo_chassi, veiculo_renavam, veiculo_valor_fipe,
    veiculo_combustivel, veiculo_ano_fabricacao, codigo_fipe,
    uso_aplicativo, tipo_entrada, tipo_venda, documentos_completos,
    data_inicio
  ) VALUES (
    'CTR-20260422133830-W3YAMM',
    v_plano_id, v_assoc_id, v_veic_id, v_vendedor_id,
    0, 553.12, 25,
    'assinado', 'assinado',
    'acd42abb359eea4efcb3b5f0d5916d0096615901dfc53c092',
    '2026-04-22 10:31:00-03','2026-04-22 10:39:00-03','2026-04-22 10:40:00-03',
    'THATYANE CHRYSTYNE DE MORAES PENA','14219916750','chrysty_moraes03@hotmail.com','21999744711',
    'R PAULO SILVA ARAUJO, 194 FT - MEIER','20735230','RIO DE JANEIRO','RJ',
    'R PAULO SILVA ARAUJO','194','MEIER','FT',
    '235680675','07261771742','1992-04-13',
    'RUP6G12','Chevrolet','tracker A Premier',2023,'PRETA',
    '9BGEP76B0PB143911','01304248957',109367.00,
    'ALCOOL/GASOLINA',2022,'004525-0',
    true, 'adesao','interna', true,
    '2026-04-22'
  ) RETURNING id INTO v_contrato_id;

  RAISE NOTICE 'Restaurado: assoc=%, veic=%, contrato=%', v_assoc_id, v_veic_id, v_contrato_id;
END $$;

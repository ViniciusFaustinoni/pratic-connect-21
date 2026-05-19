
ALTER TABLE public.sga_situacao_check
  DROP CONSTRAINT IF EXISTS sga_situacao_check_origem_resultado_check;
ALTER TABLE public.sga_situacao_check
  ADD CONSTRAINT sga_situacao_check_origem_resultado_check
  CHECK (origem_resultado = ANY (ARRAY['sga','transitorio','associado_inexistente_sga','bypass','erro','inconclusivo']));

INSERT INTO public.sga_situacao_check (
  contrato_id, associado_id, cpf, codigo_hinova,
  tem_debito, saldo_devedor, qtd_boletos_abertos,
  origem_resultado, motivo, payload
) VALUES (
  'ee5f5aa3-e8d3-4a99-b00d-a703ea3ffab4',
  'be680e14-8b63-42fa-8844-dd13996cea80',
  '13491573769',
  21020,
  true, 0, 0,
  'inconclusivo',
  'enumeracao_incompleta_sga: /associado/buscar/{cpf}/cpf retornou somente KRN9E64 (codigo_veiculo 24662, recém-criado, situacao_financeira=null). Operador reportou boletos vencidos no painel SGA para outras matrículas do mesmo CPF. Gate bloqueado para verificação manual.',
  jsonb_build_object(
    'saneamento_manual', true,
    'motivo', 'Operador reportou boletos vencidos no SGA não capturados pelo gate',
    'veiculos_enumerados_sga', jsonb_build_array(
      jsonb_build_object('placa','KRN9E64','codigo_veiculo',24662,'situacao_financeira',null)
    )
  )
);

INSERT INTO public.associados_historico (
  associado_id, contrato_id, tipo, acao, descricao, motivo, metadata
) VALUES (
  'be680e14-8b63-42fa-8844-dd13996cea80',
  'ee5f5aa3-e8d3-4a99-b00d-a703ea3ffab4',
  'observacao_adicionada',
  'gate_financeiro_inconclusivo',
  'Gate SGA do Cadastro tratado como inconclusivo. Hinova /associado/buscar/{cpf}/cpf devolveu somente o veículo recém-cadastrado (KRN9E64) sem situação financeira; boletos vencidos do CPF estavam em outras matrículas não enumeradas. Cadastro só pode prosseguir após verificação manual no painel SGA ou bypass auditado.',
  'Operador reportou boletos vencidos no painel SGA não capturados pelo gate automático.',
  jsonb_build_object('placa','KRN9E64','cpf','13491573769','codigo_hinova',21020)
);

DO $$
DECLARE
  v_associado_id uuid := 'b10ad945-2d7c-4709-bed0-35a675a6febc';
  v_xre_id uuid := '3f8213c0-e021-45b4-b68c-a85603c457cc';
  v_meriva_id uuid := '74e38766-30b1-4cec-b344-8000cd02ffd9';
  v_contrato_id uuid;
  v_cotacao_id uuid;
  v_associado_logradouro text;
  v_associado_numero text;
  v_associado_bairro text;
  v_associado_cidade text;
  v_associado_uf text;
  v_associado_cep text;
  v_existe_instalacao boolean;
BEGIN
  SELECT logradouro, numero, bairro, cidade, uf, cep
    INTO v_associado_logradouro, v_associado_numero, v_associado_bairro,
         v_associado_cidade, v_associado_uf, v_associado_cep
  FROM associados WHERE id = v_associado_id;

  SELECT id, cotacao_id INTO v_contrato_id, v_cotacao_id
  FROM contratos
  WHERE associado_id = v_associado_id AND status = 'ativo'
  ORDER BY created_at DESC
  LIMIT 1;

  UPDATE veiculos
     SET status = 'instalacao_pendente',
         cobertura_total = false,
         cobertura_roubo_furto = true
   WHERE id = v_xre_id;

  SELECT EXISTS (
    SELECT 1 FROM instalacoes
    WHERE veiculo_id = v_xre_id
      AND status IN ('agendada','em_rota','em_andamento','concluida')
  ) INTO v_existe_instalacao;

  IF NOT v_existe_instalacao THEN
    INSERT INTO instalacoes (
      associado_id, veiculo_id, contrato_id, cotacao_id,
      status, data_agendada, periodo,
      logradouro, numero, bairro, cidade, uf, cep,
      local_vistoria, permite_encaixe
    ) VALUES (
      v_associado_id, v_xre_id, v_contrato_id, v_cotacao_id,
      'agendada', CURRENT_DATE, 'manha',
      v_associado_logradouro, v_associado_numero, v_associado_bairro,
      v_associado_cidade, v_associado_uf, v_associado_cep,
      'cliente', false
    );
  END IF;

  UPDATE veiculos
     SET status = 'ativo',
         cobertura_total = true,
         cobertura_roubo_furto = true
   WHERE id = v_meriva_id;

  INSERT INTO associados_historico (
    associado_id, contrato_id, tipo, descricao, usuario_id
  ) VALUES (
    v_associado_id, v_contrato_id, 'status_alterado',
    'Correção retroativa: edge function aprovar-proposta tratava motos como carros. Honda XRE 300 (LSP3E65, FIPE R$ 14.736) passou a exigir rastreador (instalação agendada). Meriva (LUQ0573) ativada como Proteção 360° sem rastreador.',
    NULL
  );
END $$;
DO $$
DECLARE
  v_associado_id uuid := '26ac0b58-5e09-45cb-9b7b-3fda59e97176';
  v_dados_anteriores jsonb;
  v_dados_novos jsonb;
BEGIN
  SELECT jsonb_build_object(
    'nome', nome, 'cpf', cpf, 'rg', rg,
    'cnh_numero', cnh_numero, 'data_nascimento', data_nascimento
  ) INTO v_dados_anteriores
  FROM public.associados WHERE id = v_associado_id;

  UPDATE public.associados
  SET nome = 'SERGIO BARRETO DE AZEVEDO',
      cpf = '06980117750',
      rg = '108750191',
      cnh_numero = '08962659984',
      data_nascimento = '1973-08-28'
  WHERE id = v_associado_id;

  SELECT jsonb_build_object(
    'nome', nome, 'cpf', cpf, 'rg', rg,
    'cnh_numero', cnh_numero, 'data_nascimento', data_nascimento
  ) INTO v_dados_novos
  FROM public.associados WHERE id = v_associado_id;

  INSERT INTO public.logs_auditoria (
    acao, modulo, tabela, registro_id,
    dados_anteriores, dados_novos, descricao
  ) VALUES (
    'editar',
    'cadastro',
    'associados',
    v_associado_id,
    v_dados_anteriores,
    v_dados_novos,
    '[correcao_identidade_associado] Correção de identidade por erro de cadastro em cotação cancelada (placa LSA7A65). '
    || 'O registro foi reusado por nova cotação e ficou com os dados do titular errado (AURELIANO). '
    || 'Reescrito para o titular real do contrato em vigor (SERGIO BARRETO DE AZEVEDO). '
    || 'Email/telefone/status/identificador interno preservados. Mesmo padrão do caso Luiz Fernando.'
  );
END $$;
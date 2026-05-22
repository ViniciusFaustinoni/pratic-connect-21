DO $$
DECLARE v_count int;
BEGIN
  UPDATE associados
     SET status = 'aprovado', updated_at = now()
   WHERE id IN (
           '8a85497d-fa03-4b82-abeb-45c451c16fa8'::uuid,
           'f9937a83-7b66-4055-aa6e-f071b43f02bb'::uuid
         )
     AND status = 'aguardando_aprovacao_monitoramento';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO logs_auditoria (acao, modulo, tabela, descricao, dados_novos)
  VALUES (
    'editar', 'monitoramento', 'associados',
    'Saneamento: status aguardando_aprovacao_monitoramento -> aprovado para Luiz e Fernanda (pre-correcao do fluxo canonico).',
    jsonb_build_object(
      'associados', jsonb_build_array(
        '8a85497d-fa03-4b82-abeb-45c451c16fa8',
        'f9937a83-7b66-4055-aa6e-f071b43f02bb'
      ),
      'rows_updated', v_count,
      'novo_status', 'aprovado'
    )
  );
END $$;
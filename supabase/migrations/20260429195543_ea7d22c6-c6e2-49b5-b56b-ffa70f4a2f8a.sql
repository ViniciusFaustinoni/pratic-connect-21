
DO $$
DECLARE
  v_associado_tovar uuid := 'e8538d7a-aa68-4343-bb30-2a7f68846f8c';
  v_contrato_erico  uuid := '7d758a1d-d33e-464c-9b1c-ef1c91eb5a1e';
  v_veiculo_erico   uuid := '6aae322e-b207-432b-bdae-2c2a8c8916a4';
  v_contrato_tovar  uuid := '55ec5e3d-d064-4dff-a122-63cc87950762';
  v_cotacao_erico   uuid := '295bb91f-6ab2-4bf4-9ead-3a69b45964dc';
  v_associado_erico uuid;
  v_dados_anteriores jsonb;
BEGIN
  v_dados_anteriores := jsonb_build_object(
    'associado_tovar_email', (SELECT email FROM associados WHERE id = v_associado_tovar),
    'associado_tovar_telefone', (SELECT telefone FROM associados WHERE id = v_associado_tovar),
    'associado_tovar_contrato_id', (SELECT contrato_id FROM associados WHERE id = v_associado_tovar),
    'veiculo_RIR1B37_associado_id', (SELECT associado_id FROM veiculos WHERE id = v_veiculo_erico),
    'contrato_erico_associado_id', (SELECT associado_id FROM contratos WHERE id = v_contrato_erico)
  );

  UPDATE associados
     SET email = 'Tovar.rodrigueslima@gmail.com',
         telefone = '21997785858',
         updated_at = now()
   WHERE id = v_associado_tovar;

  UPDATE associados
     SET contrato_id = v_contrato_tovar
   WHERE id = v_associado_tovar;

  INSERT INTO associados (
    nome, cpf, rg, data_nascimento, cnh_validade,
    email, telefone,
    cep, logradouro, numero, complemento, bairro, cidade, uf,
    plano_id, dia_vencimento, data_adesao,
    status, contrato_id,
    origem_cadastro
  )
  SELECT
    nome_solicitante,
    regexp_replace(cliente_cpf, '\D', '', 'g'),
    cliente_rg,
    cliente_data_nascimento,
    cliente_cnh_validade,
    email_solicitante,
    telefone1_solicitante,
    cliente_cep, cliente_logradouro, cliente_numero, cliente_complemento,
    cliente_bairro, cliente_cidade, cliente_uf,
    COALESCE(plano_escolhido_id, plano_id),
    COALESCE(LEAST(GREATEST(dia_vencimento, 1), 31), 10),
    created_at::date,
    'aguardando_instalacao'::status_associado,
    v_contrato_erico,
    'interno'
  FROM cotacoes
  WHERE id = v_cotacao_erico
  RETURNING id INTO v_associado_erico;

  UPDATE contratos
     SET associado_id = v_associado_erico,
         updated_at = now()
   WHERE id = v_contrato_erico;

  UPDATE veiculos
     SET associado_id = v_associado_erico,
         updated_at = now()
   WHERE id = v_veiculo_erico;

  DELETE FROM sga_sync_queue
   WHERE veiculo_id = v_veiculo_erico
     AND associado_id = v_associado_tovar;

  UPDATE associados
     SET sincronizado_hinova = false,
         sincronizado_hinova_em = NULL
   WHERE id = v_associado_tovar;

  INSERT INTO logs_auditoria (
    acao, tabela, registro_id, descricao, dados_anteriores, dados_novos, usuario_nome
  ) VALUES (
    'editar',
    'associados',
    v_associado_tovar,
    'Saneamento manual: separado ERICO de TOVAR. PII restaurada, contrato e veículo (RIR1B37) reapontados para novo associado de ERICO (' || v_associado_erico || '). TOVAR marcado para re-sync no Hinova para corrigir contato.',
    v_dados_anteriores,
    jsonb_build_object(
      'novo_associado_erico_id', v_associado_erico,
      'tovar_email_restaurado', 'Tovar.rodrigueslima@gmail.com',
      'tovar_telefone_restaurado', '21997785858',
      'tovar_contrato_id_corrigido', v_contrato_tovar,
      'erico_contrato_id', v_contrato_erico,
      'erico_veiculo_id', v_veiculo_erico
    ),
    'sistema (correção pós-incidente RIR1B37)'
  );

  RAISE NOTICE 'Saneamento concluído. Novo associado ERICO: %', v_associado_erico;
END $$;

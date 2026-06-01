DO $$
DECLARE
  v_link_id uuid := 'ac4f2321-2372-4424-a2d7-61d0fd1dde5f';
  v_inst_id uuid := '25ba4038-28d3-481a-8406-a6543970e05a';
  v_servico_id uuid := '7794e6a0-c903-4d73-9369-979f5ce65126';
  v_imei text := '868018075843824';
  v_concluida_em timestamptz := '2026-06-01 19:08:14.802+00';
  v_iniciada_em timestamptz := '2026-06-01 19:02:00+00';
  v_rast_id uuid;
  v_vistoria_id uuid;
  v_veiculo_id uuid;
  v_associado_id uuid;
  v_contrato_id uuid;
  v_cotacao_id uuid;
BEGIN
  SELECT veiculo_id, associado_id, contrato_id, cotacao_id
    INTO v_veiculo_id, v_associado_id, v_contrato_id, v_cotacao_id
  FROM instalacoes WHERE id = v_inst_id;

  SELECT id INTO v_rast_id FROM rastreadores WHERE imei = v_imei LIMIT 1;
  IF v_rast_id IS NULL THEN
    INSERT INTO rastreadores (codigo, imei, plataforma, status, veiculo_id, associado_id, created_at, updated_at)
    VALUES ('RAST-' || RIGHT(v_imei, 6), v_imei, 'softruck', 'instalado', v_veiculo_id, v_associado_id, v_concluida_em, now())
    RETURNING id INTO v_rast_id;
  ELSE
    UPDATE rastreadores
      SET veiculo_id = v_veiculo_id, associado_id = v_associado_id, status = 'instalado', updated_at = now()
      WHERE id = v_rast_id;
  END IF;

  SELECT id INTO v_vistoria_id FROM vistorias WHERE instalacao_id = v_inst_id LIMIT 1;
  IF v_vistoria_id IS NULL THEN
    INSERT INTO vistorias (
      instalacao_id, contrato_id, associado_id, veiculo_id, cotacao_id,
      tipo, modalidade, origem, status,
      iniciada_em, concluida_em, imei_rastreador, dados_parciais
    ) VALUES (
      v_inst_id, v_contrato_id, v_associado_id, v_veiculo_id, v_cotacao_id,
      'entrada', 'presencial', 'prestador', 'concluida',
      v_iniciada_em, v_concluida_em, v_imei,
      jsonb_build_object('saneamento', 'LUT8D25 hotfix', 'origem_link', v_link_id, 'imei_fornecido_por', 'operador (chat Lovable)')
    )
    RETURNING id INTO v_vistoria_id;
  END IF;

  DELETE FROM vistoria_fotos WHERE vistoria_id = v_vistoria_id;
  INSERT INTO vistoria_fotos (vistoria_id, tipo, arquivo_url, visivel_cliente)
  SELECT
    v_vistoria_id,
    regexp_replace(regexp_replace(o.name, '^[^/]+/', ''), '_[0-9]+\.jpg$', ''),
    'https://iyxdgmukrrdkffraptsx.supabase.co/storage/v1/object/public/' || o.bucket_id || '/' || o.name,
    true
  FROM storage.objects o
  WHERE o.bucket_id = 'vistoria-prestador-fotos'
    AND o.name LIKE v_link_id::text || '/%';

  UPDATE instalacoes
    SET status = 'concluida',
        concluida_em = v_concluida_em,
        rastreador_id = v_rast_id,
        imei_rastreador = v_imei,
        updated_at = now()
  WHERE id = v_inst_id;

  UPDATE servicos
    SET status = 'concluida',
        concluida_em = v_concluida_em,
        updated_at = now()
  WHERE id = v_servico_id;

  INSERT INTO logs_auditoria (acao, modulo, descricao, registro_id, dados_novos, usuario_nome)
  VALUES (
    'aprovar',
    'instalacoes',
    '[SANEAMENTO] LUT8D25 — vistoria + instalação do prestador materializadas após falha silenciosa da edge concluir-vistoria-prestador (IMEI ' || v_imei || ' fornecido pelo operador no chat Lovable)',
    v_inst_id,
    jsonb_build_object(
      'link_id', v_link_id,
      'vistoria_id', v_vistoria_id,
      'rastreador_id', v_rast_id,
      'imei', v_imei,
      'concluida_em', v_concluida_em,
      'fotos_origem', 'storage://vistoria-prestador-fotos/' || v_link_id::text
    ),
    'Saneamento Lovable'
  );
END $$;
DO $$
DECLARE
  v_vistoria_id uuid := '8a6acf8e-88d2-4e63-a19b-84cc169e1315';
  v_servico_id  uuid := '4deef9a2-e1d8-47d1-a370-f97fb1b98388';
  v_contrato_id uuid := 'ac1b293b-c13f-4b36-a338-d297847a3a3c';
  v_cotacao_id  uuid := '1036666f-5de5-461d-a330-061b265d6040';
  v_veiculo_id  uuid := '6915f219-0d34-4169-89b1-758e982aa51e';
  v_associado_id uuid := '38575c0f-0e76-4d1f-afa7-b43511595b59';
  rec record;
  v_tipo text;
  v_url  text;
  v_inserted int := 0;
BEGIN
  INSERT INTO vistorias (
    id, associado_id, veiculo_id, contrato_id, cotacao_id,
    vistoriador_id, tipo, status, modalidade,
    data_agendada, horario_agendado,
    endereco_cep, endereco_logradouro, endereco_numero,
    endereco_bairro, endereco_cidade, endereco_estado,
    created_at, updated_at
  )
  SELECT
    v_vistoria_id, v_associado_id, v_veiculo_id, v_contrato_id, v_cotacao_id,
    NULL, 'entrada', 'em_analise', 'presencial',
    '2026-05-18'::date, '09:00'::time,
    c.cliente_cep, c.cliente_logradouro, c.cliente_numero,
    c.cliente_bairro, c.cliente_cidade, c.cliente_uf,
    '2026-05-18 19:10:40+00'::timestamptz, now()
  FROM cotacoes c
  WHERE c.id = v_cotacao_id
  ON CONFLICT (id) DO NOTHING;

  FOR rec IN
    SELECT name, created_at
    FROM storage.objects
    WHERE bucket_id = 'vistoria-fotos'
      AND name LIKE '8a6acf8e-88d2-4e63-a19b-84cc169e1315/%'
    ORDER BY created_at
  LOOP
    v_tipo := regexp_replace(
      regexp_replace(rec.name, '^[^/]+/', ''),
      '_[0-9]+\.[a-zA-Z0-9]+$', ''
    );
    v_url := 'https://iyxdgmukrrdkffraptsx.supabase.co/storage/v1/object/public/vistoria-fotos/' || rec.name;

    INSERT INTO vistoria_fotos (vistoria_id, tipo, arquivo_url, visivel_cliente, created_at)
    SELECT v_vistoria_id, v_tipo, v_url, true, rec.created_at
    WHERE NOT EXISTS (
      SELECT 1 FROM vistoria_fotos
      WHERE vistoria_id = v_vistoria_id AND arquivo_url = v_url
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  UPDATE servicos
  SET
    vistoria_origem_id = v_vistoria_id,
    status             = 'concluida',
    concluida_em       = COALESCE(concluida_em, '2026-05-18 19:53:06+00'::timestamptz),
    updated_at         = now(),
    observacoes_analise = COALESCE(observacoes_analise, '') ||
      E'\n[Resgate 18/05/2026] Vistoria presencial concluída pelo técnico — 30 fotos religadas via saneamento (prefixo storage 8a6acf8e... existia mas vistoria não havia sido materializada). Encaminhar à Aprovação de Associados.'
  WHERE id = v_servico_id;

  INSERT INTO associados_historico (
    associado_id, tipo, acao, descricao,
    veiculo_id, contrato_id, metadata, created_at
  )
  VALUES (
    v_associado_id,
    'observacao_adicionada',
    'saneamento_vistoria',
    'KNO3F78 — Vistoria presencial completa (30 fotos) recuperada via saneamento. Prefixo storage 8a6acf8e-88d2-4e63-a19b-84cc169e1315 existia mas o INSERT em vistorias/vistoria_fotos não havia sido persistido pelo app. Encaminhar para Aprovação de Associados (Monitoramento).',
    v_veiculo_id,
    v_contrato_id,
    jsonb_build_object(
      'vistoria_id', v_vistoria_id,
      'servico_id', v_servico_id,
      'fotos_processadas', v_inserted,
      'bucket', 'vistoria-fotos'
    ),
    now()
  );
END $$;
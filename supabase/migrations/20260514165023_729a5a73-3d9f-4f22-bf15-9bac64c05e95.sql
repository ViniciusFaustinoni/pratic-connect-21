DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  FOR r IN
    SELECT a.id AS associado_id, c.id AS contrato_id, c.cotacao_id, c.veiculo_id
    FROM associados a
    JOIN contratos c ON c.associado_id = a.id
    JOIN veiculos v ON v.id = c.veiculo_id
    WHERE a.status = 'ativo'
      AND c.status = 'ativo'
      AND v.status = 'instalacao_pendente'
      AND NOT EXISTS (
        SELECT 1 FROM servicos s
        WHERE s.contrato_id = c.id AND s.tipo = 'instalacao' AND s.status = 'concluida'
      )
  LOOP
    UPDATE associados
       SET status = 'aguardando_instalacao', data_ativacao = NULL, updated_at = now()
     WHERE id = r.associado_id;

    UPDATE contratos
       SET status = 'assinado', data_ativacao = NULL, updated_at = now()
     WHERE id = r.contrato_id;

    IF r.cotacao_id IS NOT NULL THEN
      UPDATE cotacoes
         SET status_contratacao = 'contrato_assinado'
       WHERE id = r.cotacao_id AND status_contratacao = 'ativo';
    END IF;

    INSERT INTO ativacao_status_log (associado_id, contrato_id, from_status, to_status, source, payload)
    VALUES (
      r.associado_id, r.contrato_id, 'ativo', 'aguardando_instalacao',
      'manual:fix-bug-aguardar-instalacao',
      jsonb_build_object(
        'motivo', 'rollback de ativação indevida — bug edge ativar-associado ignorava aguardar_instalacao',
        'cotacao_id', r.cotacao_id,
        'veiculo_id', r.veiculo_id,
        'contrato_revertido_para', 'assinado'
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Rollback concluido: % registros revertidos', v_count;
END $$;
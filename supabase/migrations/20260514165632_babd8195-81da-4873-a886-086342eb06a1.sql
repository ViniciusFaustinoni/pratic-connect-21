DO $$
DECLARE
  c RECORD;
  v_count INT := 0;
BEGIN
  FOR c IN
    SELECT cm.* FROM comissoes cm
    JOIN ativacao_status_log l ON l.contrato_id = cm.contrato_id
    WHERE l.source = 'manual:fix-bug-aguardar-instalacao'
      AND cm.pago_em IS NULL
      AND cm.aprovado_em IS NULL
  LOOP
    -- Tenta logar em comissoes_auditoria; se não existir/colunas diferentes, segue
    BEGIN
      INSERT INTO comissoes_auditoria (comissao_id, evento, payload, created_at)
      VALUES (
        c.id,
        'rollback_bug_ativacao',
        to_jsonb(c) || jsonb_build_object('motivo', 'comissão fantasma criada por ativação indevida — bug edge ativar-associado'),
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    DELETE FROM comissoes WHERE id = c.id;
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Comissões removidas: %', v_count;
END $$;
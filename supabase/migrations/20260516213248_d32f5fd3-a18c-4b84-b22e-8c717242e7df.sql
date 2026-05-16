
DROP TRIGGER IF EXISTS trg_recompute_cotacao_from_contrato ON contratos;
CREATE TRIGGER trg_recompute_cotacao_from_contrato
AFTER INSERT OR UPDATE OF status, adesao_paga, cadastro_aprovado, data_assinatura, cotacao_id ON contratos
FOR EACH ROW
EXECUTE FUNCTION public.trg_recompute_cotacao_from_contrato();

DROP TRIGGER IF EXISTS trg_recompute_cotacao_from_associado ON associados;
CREATE TRIGGER trg_recompute_cotacao_from_associado
AFTER UPDATE OF status ON associados
FOR EACH ROW
EXECUTE FUNCTION public.trg_recompute_cotacao_from_associado();

DROP TRIGGER IF EXISTS trg_recompute_cotacao_from_instalacao ON instalacoes;
CREATE TRIGGER trg_recompute_cotacao_from_instalacao
AFTER INSERT OR UPDATE OF status ON instalacoes
FOR EACH ROW
EXECUTE FUNCTION public.trg_recompute_cotacao_from_instalacao();

DO $$
DECLARE
  r record;
  v_old text;
  v_new text;
BEGIN
  FOR r IN
    SELECT DISTINCT c.id, c.status_contratacao AS old_status
    FROM cotacoes c
    LEFT JOIN contratos ct ON ct.cotacao_id = c.id
    LEFT JOIN associados a ON a.id = ct.associado_id
    WHERE c.status_contratacao NOT IN ('ativo','cancelado','veiculo_recusado')
      AND (
        a.status = 'ativo'
        OR (ct.adesao_paga = true AND ct.status IN ('assinado','ativo'))
        OR EXISTS (SELECT 1 FROM instalacoes i WHERE i.cotacao_id = c.id AND i.status::text = 'concluida')
      )
  LOOP
    v_old := r.old_status;
    PERFORM public.recompute_cotacao_status_contratacao(r.id);
    SELECT status_contratacao INTO v_new FROM cotacoes WHERE id = r.id;
    IF v_new IS DISTINCT FROM v_old THEN
      INSERT INTO cotacoes_historico (cotacao_id, acao, detalhes, autor_nome, created_at)
      VALUES (
        r.id,
        'backfill_status_contratacao',
        jsonb_build_object('de', v_old, 'para', v_new, 'origem', 'migration_sync_link_publico'),
        'system',
        now()
      );
    END IF;
  END LOOP;
END $$;

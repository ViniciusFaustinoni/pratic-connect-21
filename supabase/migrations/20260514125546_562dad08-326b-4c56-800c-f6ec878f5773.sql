DO $$
DECLARE
  v_cotacao_id uuid;
BEGIN
  SELECT id
    INTO v_cotacao_id
  FROM public.cotacoes
  WHERE numero = 'COT-20260513-192005877-360'
    AND tipo_entrada = 'troca_titularidade'
  LIMIT 1;

  IF v_cotacao_id IS NULL THEN
    RAISE NOTICE 'Cotação COT-20260513-192005877-360 não encontrada; nada para remover.';
    RETURN;
  END IF;

  DELETE FROM public.relacionamento_debitos_pendentes
  WHERE solicitacao_troca_id IN (
    SELECT id
    FROM public.solicitacoes_troca_titularidade
    WHERE cotacao_id = v_cotacao_id
  );

  DELETE FROM public.solicitacoes_troca_titularidade
  WHERE cotacao_id = v_cotacao_id;

  DELETE FROM public.agendamentos_base
  WHERE cotacao_id = v_cotacao_id;

  DELETE FROM public.cotacoes
  WHERE id = v_cotacao_id;
END $$;
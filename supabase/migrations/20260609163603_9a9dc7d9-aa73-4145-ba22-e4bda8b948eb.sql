DO $$
DECLARE
  v_cotacao_id uuid := 'fb3a2b12-4b98-466e-b8c4-4ff4d2c063d4';
  v_status_anterior text;
BEGIN
  SELECT status_contratacao INTO v_status_anterior
  FROM public.cotacoes WHERE id = v_cotacao_id FOR UPDATE;

  IF v_status_anterior IS NULL THEN
    RAISE EXCEPTION 'Cotação % não encontrada', v_cotacao_id;
  END IF;

  IF v_status_anterior <> 'contrato_assinado' THEN
    RAISE NOTICE 'Cotação % está em %, saneamento ignorado.', v_cotacao_id, v_status_anterior;
    RETURN;
  END IF;

  UPDATE public.cotacoes
     SET status_contratacao = 'pagamento_ok',
         updated_at = now()
   WHERE id = v_cotacao_id;

  INSERT INTO public.logs_auditoria (
    usuario_id, usuario_nome, acao, modulo, descricao, tabela, registro_id, dados_novos
  ) VALUES (
    NULL,
    'sistema',
    'criar',
    'cotacao',
    '[SANEAMENTO_KXL5D31] status_contratacao contrato_assinado -> pagamento_ok p/ devolver cliente à etapa 5 (Vistoria) no link público — sub-FIPE sem via escolhida. COT-20260609-124904496-110.',
    'cotacoes',
    v_cotacao_id,
    jsonb_build_object(
      'status_contratacao_anterior', v_status_anterior,
      'status_contratacao_novo', 'pagamento_ok',
      'motivo', 'saneamento_manual_via_sub_fipe_nao_escolhida'
    )
  );
END $$;
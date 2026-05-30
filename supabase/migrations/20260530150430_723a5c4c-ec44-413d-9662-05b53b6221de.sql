
CREATE OR REPLACE FUNCTION public.fn_confirmar_adesao_zerada(
  p_cotacao_id uuid,
  p_origem text
)
RETURNS TABLE(
  contrato_id uuid,
  status_contratacao text,
  idempotente boolean,
  ok boolean,
  erro text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cotacao record;
  v_contrato record;
  v_status_inicial text;
  v_idempotente boolean := false;
BEGIN
  IF p_origem NOT IN ('adesao_zerada', 'agencia_em_maos') THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, false, 'origem_invalida';
    RETURN;
  END IF;

  SELECT id, valor_adesao, status_contratacao, contrato_gerado_id
    INTO v_cotacao
  FROM public.cotacoes
  WHERE id = p_cotacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, false, 'cotacao_nao_encontrada';
    RETURN;
  END IF;

  IF v_cotacao.contrato_gerado_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, v_cotacao.status_contratacao::text, false, false, 'contrato_nao_encontrado';
    RETURN;
  END IF;

  SELECT id, adesao_paga
    INTO v_contrato
  FROM public.contratos
  WHERE id = v_cotacao.contrato_gerado_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, v_cotacao.status_contratacao::text, false, false, 'contrato_nao_encontrado';
    RETURN;
  END IF;

  -- Valida: adesão tem que ser zerada OU origem agência em mãos
  IF p_origem = 'adesao_zerada' AND COALESCE(v_cotacao.valor_adesao, 0) > 0 THEN
    RETURN QUERY SELECT v_contrato.id, v_cotacao.status_contratacao::text, false, false, 'adesao_nao_zerada';
    RETURN;
  END IF;

  v_status_inicial := v_cotacao.status_contratacao;

  -- Idempotente: já está em pagamento_ok (ou além) e contrato já pago
  IF v_contrato.adesao_paga = true
     AND v_cotacao.status_contratacao IS NOT NULL
     AND v_cotacao.status_contratacao <> 'contrato_assinado' THEN
    v_idempotente := true;
  END IF;

  -- Marca contrato pago
  UPDATE public.contratos
     SET adesao_paga = true,
         adesao_isenta_agencia = CASE WHEN p_origem = 'agencia_em_maos' THEN true
                                      ELSE COALESCE(adesao_isenta_agencia, false) END,
         updated_at = now()
   WHERE id = v_contrato.id;

  -- Promove cotação: contrato_assinado -> pagamento_ok via CAS
  UPDATE public.cotacoes
     SET status_contratacao = 'pagamento_ok',
         updated_at = now()
   WHERE id = p_cotacao_id
     AND status_contratacao = 'contrato_assinado';

  -- Retorna estado canônico atual
  SELECT status_contratacao INTO v_status_inicial
    FROM public.cotacoes WHERE id = p_cotacao_id;

  RETURN QUERY SELECT v_contrato.id, v_status_inicial::text, v_idempotente, true, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_confirmar_adesao_zerada(uuid, text) TO service_role;

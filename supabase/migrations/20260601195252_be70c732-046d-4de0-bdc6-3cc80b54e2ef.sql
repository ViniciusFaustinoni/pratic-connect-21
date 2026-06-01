CREATE OR REPLACE FUNCTION public.fn_confirmar_adesao_zerada(p_cotacao_id uuid, p_origem text)
 RETURNS TABLE(contrato_id uuid, status_contratacao text, idempotente boolean, ok boolean, erro text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT c.id, c.valor_adesao, c.status_contratacao, c.contrato_gerado_id
    INTO v_cotacao
  FROM public.cotacoes c
  WHERE c.id = p_cotacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, false, 'cotacao_nao_encontrada';
    RETURN;
  END IF;

  IF v_cotacao.contrato_gerado_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, v_cotacao.status_contratacao::text, false, false, 'contrato_nao_encontrado';
    RETURN;
  END IF;

  SELECT ct.id, ct.adesao_paga
    INTO v_contrato
  FROM public.contratos ct
  WHERE ct.id = v_cotacao.contrato_gerado_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, v_cotacao.status_contratacao::text, false, false, 'contrato_nao_encontrado';
    RETURN;
  END IF;

  IF p_origem = 'adesao_zerada' AND COALESCE(v_cotacao.valor_adesao, 0) > 0 THEN
    RETURN QUERY SELECT v_contrato.id, v_cotacao.status_contratacao::text, false, false, 'adesao_nao_zerada';
    RETURN;
  END IF;

  v_status_inicial := v_cotacao.status_contratacao;

  IF v_contrato.adesao_paga = true
     AND v_cotacao.status_contratacao IS NOT NULL
     AND v_cotacao.status_contratacao <> 'contrato_assinado' THEN
    v_idempotente := true;
  END IF;

  UPDATE public.contratos ct
     SET adesao_paga = true,
         adesao_isenta_agencia = CASE WHEN p_origem = 'agencia_em_maos' THEN true
                                      ELSE COALESCE(ct.adesao_isenta_agencia, false) END,
         updated_at = now()
   WHERE ct.id = v_contrato.id;

  UPDATE public.cotacoes c
     SET status_contratacao = 'pagamento_ok',
         updated_at = now()
   WHERE c.id = p_cotacao_id
     AND c.status_contratacao = 'contrato_assinado';

  SELECT c.status_contratacao INTO v_status_inicial
    FROM public.cotacoes c WHERE c.id = p_cotacao_id;

  RETURN QUERY SELECT v_contrato.id, v_status_inicial::text, v_idempotente, true, NULL::text;
END;
$function$;
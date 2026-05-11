
CREATE OR REPLACE FUNCTION public.fn_troca_pos_assinatura_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sol RECORD;
  v_servico_id UUID;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF NEW.adesao_paga IS NOT TRUE THEN RETURN NEW; END IF;
  IF OLD.adesao_paga IS NOT DISTINCT FROM NEW.adesao_paga THEN RETURN NEW; END IF;
  IF NEW.cotacao_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_sol
  FROM public.solicitacoes_troca_titularidade
  WHERE cotacao_id = NEW.cotacao_id
    AND efetivada_em IS NULL
    AND status = 'liberada_para_assinatura'
  FOR UPDATE;

  IF NOT FOUND THEN RETURN NEW; END IF;

  v_servico_id := v_sol.servico_vistoria_id;

  IF v_servico_id IS NULL THEN
    SELECT id INTO v_servico_id
    FROM public.servicos
    WHERE veiculo_id = v_sol.veiculo_id
      AND tipo = 'vistoria_entrada'
      AND origem = 'troca_titularidade'
      AND status IN ('pendente','agendada','em_rota','em_andamento','em_analise','reagendada')
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_servico_id IS NULL THEN
    INSERT INTO public.servicos (
      tipo, status, origem, modalidade,
      associado_id, veiculo_id, contrato_id, cotacao_id,
      observacoes, solicitado_por_modulo
    ) VALUES (
      'vistoria_entrada', 'pendente', 'troca_titularidade', 'presencial',
      NEW.associado_id, v_sol.veiculo_id, NEW.id, NEW.cotacao_id,
      format('Vistoria de campo — troca de titularidade (solicitação %s). Disparada após assinatura + pagamento. Aprovação obrigatória do Monitoramento antes da efetivação.', v_sol.id),
      'troca_titularidade'
    )
    RETURNING id INTO v_servico_id;
  END IF;

  UPDATE public.solicitacoes_troca_titularidade
     SET status = 'aguardando_vistoria',
         servico_vistoria_id = v_servico_id,
         updated_at = v_now
   WHERE id = v_sol.id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_troca_pos_assinatura_pagamento ON public.contratos;

CREATE TRIGGER trg_troca_pos_assinatura_pagamento
AFTER UPDATE OF adesao_paga ON public.contratos
FOR EACH ROW
EXECUTE FUNCTION public.fn_troca_pos_assinatura_pagamento();

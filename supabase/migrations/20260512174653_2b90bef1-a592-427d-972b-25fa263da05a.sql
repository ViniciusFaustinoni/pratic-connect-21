
CREATE OR REPLACE FUNCTION public.fn_normalizar_associado_servico_troca()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol_id UUID;
  v_novo_assoc UUID;
  v_efetivada TIMESTAMPTZ;
  v_cotacao UUID;
  v_contrato_novo UUID;
BEGIN
  IF NEW.cotacao_id IS NOT NULL THEN
    SELECT id, novo_associado_id, efetivada_em, cotacao_id
      INTO v_sol_id, v_novo_assoc, v_efetivada, v_cotacao
      FROM public.solicitacoes_troca_titularidade
     WHERE cotacao_id = NEW.cotacao_id
     LIMIT 1;
  END IF;

  IF v_sol_id IS NULL AND NEW.vistoria_origem_id IS NOT NULL THEN
    SELECT s.id, s.novo_associado_id, s.efetivada_em, s.cotacao_id
      INTO v_sol_id, v_novo_assoc, v_efetivada, v_cotacao
      FROM public.solicitacoes_troca_titularidade s
      JOIN public.vistorias v ON v.veiculo_id = s.veiculo_id
     WHERE v.id = NEW.vistoria_origem_id
       AND s.cotacao_id IS NOT NULL
     ORDER BY s.created_at DESC
     LIMIT 1;
  END IF;

  IF v_sol_id IS NULL OR v_novo_assoc IS NULL OR v_efetivada IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.associado_id IS DISTINCT FROM v_novo_assoc THEN
    NEW.associado_id := v_novo_assoc;
  END IF;

  IF NEW.contrato_id IS NULL AND v_cotacao IS NOT NULL THEN
    SELECT id INTO v_contrato_novo
      FROM public.contratos
     WHERE cotacao_id = v_cotacao
       AND associado_id = v_novo_assoc
       AND status IN ('assinado', 'pendente', 'pendente_assinatura', 'ativo')
     ORDER BY created_at DESC
     LIMIT 1;
    IF v_contrato_novo IS NOT NULL THEN
      NEW.contrato_id := v_contrato_novo;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_servicos_troca_titularidade_normaliza_associado ON public.servicos;
CREATE TRIGGER trg_servicos_troca_titularidade_normaliza_associado
BEFORE INSERT OR UPDATE OF associado_id, contrato_id, cotacao_id, vistoria_origem_id
ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.fn_normalizar_associado_servico_troca();

UPDATE public.servicos s
   SET associado_id = sol.novo_associado_id,
       contrato_id  = COALESCE(s.contrato_id, c.id),
       updated_at   = now()
  FROM public.solicitacoes_troca_titularidade sol
  LEFT JOIN public.contratos c
    ON c.cotacao_id = sol.cotacao_id
   AND c.associado_id = sol.novo_associado_id
   AND c.status IN ('assinado', 'pendente', 'pendente_assinatura', 'ativo')
 WHERE sol.novo_associado_id IS NOT NULL
   AND sol.efetivada_em IS NULL
   AND (s.cotacao_id = sol.cotacao_id
        OR s.vistoria_origem_id IN (
             SELECT v.id FROM public.vistorias v
              WHERE v.veiculo_id = sol.veiculo_id
           ))
   AND s.associado_id IS DISTINCT FROM sol.novo_associado_id
   AND s.status::text NOT IN ('concluida', 'aprovada', 'aprovada_ressalvas', 'reprovada', 'cancelada');

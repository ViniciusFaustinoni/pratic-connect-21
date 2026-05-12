-- Troca de Titularidade: Monitoramento só vê o caso APÓS vistoria do novo titular concluída
-- 1) Função que promove a solicitação para aguardando_monitoramento quando a vistoria
--    do novo titular é concluída (status em_analise/concluida/aprovada).
CREATE OR REPLACE FUNCTION public.fn_troca_promover_monitoramento_pos_vistoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sol_id uuid;
  _origem text;
BEGIN
  -- Apenas reagir quando o status mudou para um terminal de "fotos prontas para análise"
  IF NEW.status::text NOT IN ('em_analise', 'concluida', 'aprovada') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Só interessa vistorias originadas de troca de titularidade
  _origem := COALESCE(NEW.origem, '');
  IF _origem <> 'troca_titularidade' THEN
    -- fallback: tentar localizar via servico vinculado
    SELECT s.id INTO _sol_id
    FROM public.solicitacoes_troca_titularidade s
    WHERE s.veiculo_id = NEW.veiculo_id
      AND s.efetivada_em IS NULL
      AND s.status IN ('liberada_para_assinatura','aguardando_vistoria','aguardando_monitoramento')
    ORDER BY s.created_at DESC
    LIMIT 1;
  ELSE
    SELECT s.id INTO _sol_id
    FROM public.solicitacoes_troca_titularidade s
    WHERE s.veiculo_id = NEW.veiculo_id
      AND s.efetivada_em IS NULL
    ORDER BY s.created_at DESC
    LIMIT 1;
  END IF;

  IF _sol_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotente: só promove se ainda está em fase pré-monitoramento
  UPDATE public.solicitacoes_troca_titularidade
  SET status = 'aguardando_monitoramento',
      updated_at = now()
  WHERE id = _sol_id
    AND status IN ('liberada_para_assinatura','aguardando_vistoria');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_troca_promover_monitoramento_pos_vistoria] erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_troca_promover_monitoramento_pos_vistoria ON public.vistorias;
CREATE TRIGGER trg_troca_promover_monitoramento_pos_vistoria
AFTER INSERT OR UPDATE OF status ON public.vistorias
FOR EACH ROW
EXECUTE FUNCTION public.fn_troca_promover_monitoramento_pos_vistoria();

-- 2) Backfill: solicitações hoje paradas em aguardando_monitoramento SEM vistoria pronta
--    devem voltar para liberada_para_assinatura (para destravar o fluxo do novo titular).
UPDATE public.solicitacoes_troca_titularidade s
SET status = 'liberada_para_assinatura', updated_at = now()
WHERE s.status = 'aguardando_monitoramento'
  AND s.efetivada_em IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.vistorias v
    WHERE v.veiculo_id = s.veiculo_id
      AND v.status::text IN ('em_analise','concluida','aprovada')
  );
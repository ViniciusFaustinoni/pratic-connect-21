
-- 1) Nova coluna: marca quando a autovistoria do novo titular foi concluída
ALTER TABLE public.solicitacoes_troca_titularidade
  ADD COLUMN IF NOT EXISTS autovistoria_concluida_em timestamptz;

-- 2) Reescreve trigger: NÃO promover automaticamente para aguardando_monitoramento
--    quando ainda está em aguardando_cadastro. Apenas marca autovistoria_concluida_em.
--    Promoção para aguardando_monitoramento só ocorre quando vistoria foi pedida pelo
--    Monitoramento (status aguardando_vistoria) ou já estava liberada_para_assinatura
--    (loop de revistoria).
CREATE OR REPLACE FUNCTION public.fn_troca_promover_monitoramento_pos_vistoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sol_id uuid;
  _sol_status text;
  _origem text;
BEGIN
  IF NEW.status::text NOT IN ('em_analise', 'concluida', 'aprovada') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  _origem := COALESCE(NEW.origem, '');

  SELECT s.id, s.status::text INTO _sol_id, _sol_status
  FROM public.solicitacoes_troca_titularidade s
  WHERE s.veiculo_id = NEW.veiculo_id
    AND s.efetivada_em IS NULL
    AND s.status IN (
      'aguardando_cadastro',
      'liberada_para_assinatura',
      'aguardando_vistoria',
      'aguardando_monitoramento'
    )
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _sol_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sempre marca a autovistoria como concluída (idempotente)
  UPDATE public.solicitacoes_troca_titularidade
  SET autovistoria_concluida_em = COALESCE(autovistoria_concluida_em, now()),
      updated_at = now()
  WHERE id = _sol_id;

  -- Promove para aguardando_monitoramento APENAS quando vistoria foi pedida
  -- pelo Monitoramento (aguardando_vistoria) ou loop pós-liberação.
  -- NUNCA promove a partir de aguardando_cadastro (Cadastro precisa analisar).
  IF _sol_status IN ('aguardando_vistoria', 'liberada_para_assinatura') THEN
    UPDATE public.solicitacoes_troca_titularidade
    SET status = 'aguardando_monitoramento',
        updated_at = now()
    WHERE id = _sol_id
      AND status IN ('aguardando_vistoria', 'liberada_para_assinatura');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_troca_promover_monitoramento_pos_vistoria] erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 3) Backfill A: solicitações em aguardando_cadastro que já têm vistoria pronta
UPDATE public.solicitacoes_troca_titularidade s
SET autovistoria_concluida_em = COALESCE(s.autovistoria_concluida_em, now()),
    updated_at = now()
WHERE s.status = 'aguardando_cadastro'
  AND s.autovistoria_concluida_em IS NULL
  AND EXISTS (
    SELECT 1 FROM public.vistorias v
    WHERE v.veiculo_id = s.veiculo_id
      AND v.status::text IN ('em_analise','concluida','aprovada')
  );

-- 4) Backfill B: solicitações que pularam o Cadastro pelo fluxo antigo
-- (estão em liberada_para_assinatura sem aprovação do Monitoramento) voltam
-- para aguardando_monitoramento para o Monitoramento decidir manualmente.
UPDATE public.solicitacoes_troca_titularidade s
SET status = 'aguardando_monitoramento',
    updated_at = now()
WHERE s.status = 'liberada_para_assinatura'
  AND s.aprovado_monitoramento_em IS NULL
  AND s.efetivada_em IS NULL;

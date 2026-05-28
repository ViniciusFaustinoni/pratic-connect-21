
-- ============================================================================
-- TROCA TITULARIDADE — Fechamento do ciclo (rodada 3)
-- 1) Guard explícito no gate de promoção
-- 2) Unificação de fn_troca_promover_monitoramento_pos_vistoria (DROP + recreate)
-- ============================================================================

-- 1) Gate canônico — só promove a partir de efetivacao_pendente.
--    Lista deliberadamente restrita; qualquer outro status deve transicionar
--    antes (responsabilidade da edge `efetivar-troca-titularidade` ou da
--    trigger fn_efetivar_troca_pos_vistoria).
CREATE OR REPLACE FUNCTION public.fn_promover_troca_se_completo(_solicitacao_id uuid)
RETURNS TABLE(promovida boolean, status text, pontas_pendentes text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol RECORD;
  v_fila_pendente boolean;
  v_fila_manual boolean;
  v_pendentes text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO v_sol
  FROM public.solicitacoes_troca_titularidade
  WHERE id = _solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, ARRAY[]::text[];
    RETURN;
  END IF;

  IF v_sol.status = 'efetivada' THEN
    RETURN QUERY SELECT false, v_sol.status, ARRAY[]::text[];
    RETURN;
  END IF;

  -- Guard explícito: única origem válida de promoção é efetivacao_pendente.
  IF v_sol.status NOT IN ('efetivacao_pendente') THEN
    RETURN QUERY SELECT false, v_sol.status,
                        ARRAY['status_nao_promovivel:' || v_sol.status];
    RETURN;
  END IF;

  IF v_sol.aprovado_monitoramento_em IS NULL THEN
    v_pendentes := array_append(v_pendentes, 'monitoramento');
  END IF;

  IF COALESCE(v_sol.sga_status, '') NOT IN ('sincronizado') THEN
    v_pendentes := array_append(v_pendentes, 'sga');
  END IF;

  IF COALESCE(v_sol.plataforma_rastreador_status, '') NOT IN ('sincronizado', 'nao_aplicavel') THEN
    v_pendentes := array_append(v_pendentes, 'plataforma_rastreador');
  END IF;

  -- Itens automatizáveis ainda na fila (pendente/processando/falha).
  -- falha_permanente NÃO bloqueia (ou é manual ou retries esgotados — operador resolve).
  SELECT EXISTS (
    SELECT 1 FROM public.sga_sync_queue q
    WHERE q.origem = 'troca_titularidade'
      AND q.status IN ('pendente', 'processando', 'falha')
      AND (
        (q.veiculo_id = v_sol.veiculo_id AND q.associado_id = v_sol.novo_associado_id)
        OR q.veiculo_id = v_sol.veiculo_id
      )
  ) INTO v_fila_pendente;

  IF v_fila_pendente THEN
    v_pendentes := array_append(v_pendentes, 'sga_sync_queue');
  END IF;

  -- Bloqueia também enquanto houver ação manual pendente vinculada à troca
  -- (codigo_associado_nao_encontrado fica em falha_permanente — operador
  -- precisa preencher codigo_hinova manualmente antes de fechar a troca).
  SELECT EXISTS (
    SELECT 1 FROM public.sga_sync_queue q
    WHERE q.origem = 'troca_titularidade'
      AND q.etapa_parou = 'troca_titularidade:codigo_associado_nao_encontrado'
      AND q.status <> 'concluido'
      AND q.veiculo_id = v_sol.veiculo_id
  ) INTO v_fila_manual;

  IF v_fila_manual THEN
    v_pendentes := array_append(v_pendentes, 'sga_acao_manual');
  END IF;

  IF array_length(v_pendentes, 1) IS NULL THEN
    UPDATE public.solicitacoes_troca_titularidade
       SET status = 'efetivada',
           updated_at = now(),
           efetivada_em = COALESCE(efetivada_em, now())
     WHERE id = _solicitacao_id;

    RETURN QUERY SELECT true, 'efetivada'::text, ARRAY[]::text[];
  ELSE
    RETURN QUERY SELECT false, v_sol.status, v_pendentes;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_promover_troca_se_completo(uuid) TO authenticated, service_role;

-- 2) Consolidar versões coexistindo de fn_troca_promover_monitoramento_pos_vistoria.
--    DROP CASCADE remove a trigger antiga; recriamos a versão canônica
--    (2026-05-14, não promove de aguardando_cadastro).
DROP FUNCTION IF EXISTS public.fn_troca_promover_monitoramento_pos_vistoria() CASCADE;

CREATE FUNCTION public.fn_troca_promover_monitoramento_pos_vistoria()
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

  UPDATE public.solicitacoes_troca_titularidade
  SET autovistoria_concluida_em = COALESCE(autovistoria_concluida_em, now()),
      updated_at = now()
  WHERE id = _sol_id;

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

CREATE TRIGGER trg_troca_promover_monitoramento_pos_vistoria
AFTER INSERT OR UPDATE OF status ON public.vistorias
FOR EACH ROW
EXECUTE FUNCTION public.fn_troca_promover_monitoramento_pos_vistoria();

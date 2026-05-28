CREATE OR REPLACE FUNCTION public.fn_promover_troca_se_completo(_solicitacao_id uuid)
RETURNS TABLE(promovida boolean, status text, pontas_pendentes text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol RECORD;
  v_fila_pendente boolean;
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

  IF v_sol.status NOT IN ('efetivacao_pendente') THEN
    RETURN QUERY SELECT false, v_sol.status, ARRAY['status_nao_promovivel:' || v_sol.status];
    RETURN;
  END IF;

  IF v_sol.aprovado_monitoramento_em IS NULL THEN
    v_pendentes := array_append(v_pendentes, 'monitoramento');
  END IF;

  IF COALESCE(v_sol.sga_status, '') <> 'sincronizado' THEN
    v_pendentes := array_append(v_pendentes, 'sga');
  END IF;

  IF COALESCE(v_sol.plataforma_rastreador_status, '') NOT IN ('sincronizado', 'nao_aplicavel') THEN
    v_pendentes := array_append(v_pendentes, 'plataforma_rastreador');
  END IF;

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

CREATE OR REPLACE FUNCTION public.fn_efetivar_troca_pos_vistoria()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sol RECORD;
  v_novo_contrato RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF NEW.tipo <> 'vistoria_entrada' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.origem, '') <> 'troca_titularidade' THEN RETURN NEW; END IF;
  IF NEW.cotacao_id IS NULL THEN RETURN NEW; END IF;

  IF NOT (
    (NEW.status IN ('aprovada', 'concluida'))
    AND COALESCE(NEW.decisao_instalador, '') IN ('aprovado', 'aprovado_ressalva')
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.decisao_instalador IS DISTINCT FROM NEW.decisao_instalador
    )
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_sol
  FROM public.solicitacoes_troca_titularidade
  WHERE cotacao_id = NEW.cotacao_id
    AND efetivada_em IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT id, numero, associado_id INTO v_novo_contrato
  FROM public.contratos
  WHERE cotacao_id = v_sol.cotacao_id
    AND status IN ('assinado', 'pendente', 'aguardando_instalacao')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.contratos
     SET status = 'cancelado',
         data_cancelamento = v_now,
         motivo_cancelamento = COALESCE(motivo_cancelamento, 'Troca de titularidade'),
         updated_at = v_now
   WHERE associado_id = v_sol.associado_antigo_id
     AND id <> v_novo_contrato.id
     AND status IN ('ativo', 'pendente', 'assinado', 'aguardando_instalacao');

  UPDATE public.contratos
     SET status = 'ativo',
         data_ativacao = v_now,
         aprovado_em = COALESCE(aprovado_em, v_now),
         updated_at = v_now
   WHERE id = v_novo_contrato.id;

  UPDATE public.veiculos
     SET associado_id = v_novo_contrato.associado_id,
         em_troca_titularidade = false,
         troca_titularidade_id = NULL,
         troca_titularidade_iniciada_em = NULL,
         cobertura_suspensa = false,
         cobertura_suspensa_em = NULL,
         cobertura_suspensa_motivo = NULL,
         updated_at = v_now
   WHERE id = v_sol.veiculo_id;

  UPDATE public.solicitacoes_troca_titularidade
     SET status = 'efetivacao_pendente',
         efetivada_em = v_now,
         novo_associado_id = v_novo_contrato.associado_id,
         updated_at = v_now
   WHERE id = v_sol.id;

  PERFORM public.fn_promover_troca_se_completo(v_sol.id);

  INSERT INTO public.contratos_historico (contrato_id, evento, descricao, dados)
  VALUES (
    v_novo_contrato.id,
    'efetivado_troca_titularidade',
    format('Troca de titularidade efetivada após aprovação do Monitoramento (serviço %s)', NEW.id),
    jsonb_build_object('solicitacao_id', v_sol.id, 'servico_id', NEW.id, 'associado_antigo_id', v_sol.associado_antigo_id)
  );

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.concluir_instalacao_prestador(p_instalacao_id uuid, p_observacao text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_inst RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.has_role(v_user, 'admin'::app_role)
    OR public.has_role(v_user, 'admin_master'::app_role)
    OR public.has_role(v_user, 'diretor'::app_role)
    OR public.has_role(v_user, 'desenvolvedor'::app_role)
    OR public.has_role(v_user, 'coordenador_monitoramento'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para concluir instalação por prestador';
  END IF;

  IF p_observacao IS NULL OR length(trim(p_observacao)) < 5 THEN
    RAISE EXCEPTION 'Observação obrigatória (mínimo 5 caracteres)';
  END IF;

  SELECT * INTO v_inst FROM public.instalacoes WHERE id = p_instalacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instalação não encontrada';
  END IF;

  IF v_inst.status = 'concluida' THEN
    RAISE EXCEPTION 'Instalação já concluída';
  END IF;

  UPDATE public.instalacoes
  SET status = 'concluida'::status_instalacao,
      concluida_em = now(),
      observacoes = COALESCE(observacoes || E'\n', '') ||
        '[CONCLUSÃO ADMIN/PRESTADOR EXTERNO ' || to_char(now(),'DD/MM/YYYY HH24:MI') || '] ' || p_observacao,
      updated_at = now()
  WHERE id = p_instalacao_id;

  -- Fecha agendamento_base correspondente, se houver
  UPDATE public.agendamentos_base
  SET status = 'concluido', updated_at = now()
  WHERE instalacao_id = p_instalacao_id
    AND status NOT IN ('concluido','cancelado');

  -- Marca serviço materializado como concluído
  UPDATE public.servicos_campo
  SET status = 'concluido', updated_at = now()
  WHERE instalacao_id = p_instalacao_id
    AND status NOT IN ('concluido','cancelado');

  RETURN jsonb_build_object('success', true, 'instalacao_id', p_instalacao_id);
END;
$function$;
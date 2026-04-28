-- 1) RPC transacional para iniciar rota
CREATE OR REPLACE FUNCTION public.iniciar_rota_servico(p_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_servico record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_AUTENTICADO',
      'mensagem', 'Sessão expirada. Faça login novamente.');
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PROFILE_NAO_ENCONTRADO',
      'mensagem', 'Seu perfil de profissional não foi encontrado.');
  END IF;

  SELECT id, status::text AS status, profissional_id
    INTO v_servico
    FROM public.servicos
   WHERE id = p_servico_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'SERVICO_NAO_ENCONTRADO',
      'mensagem', 'Esta tarefa não existe mais.');
  END IF;

  IF v_servico.profissional_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'SERVICO_SEM_PROFISSIONAL',
      'mensagem', 'Esta tarefa foi cancelada e não está mais disponível.');
  END IF;

  IF v_servico.profissional_id <> v_profile_id THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'SERVICO_REATRIBUIDO',
      'mensagem', 'Esta tarefa foi reatribuída a outro técnico.');
  END IF;

  IF v_servico.status NOT IN ('agendada','em_rota') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'STATUS_INVALIDO',
      'mensagem', 'Esta tarefa não pode mais ser iniciada (status atual: ' || v_servico.status || ').');
  END IF;

  IF v_servico.status = 'em_rota' THEN
    RETURN jsonb_build_object('ok', true, 'codigo', 'JA_EM_ROTA',
      'mensagem', 'Rota já estava iniciada.');
  END IF;

  UPDATE public.servicos
     SET status = 'em_rota',
         em_rota_em = now(),
         updated_at = now()
   WHERE id = p_servico_id
     AND profissional_id = v_profile_id
     AND status = 'agendada';

  RETURN jsonb_build_object('ok', true, 'codigo', 'OK',
    'mensagem', 'Rota iniciada.');
END;
$$;

REVOKE ALL ON FUNCTION public.iniciar_rota_servico(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.iniciar_rota_servico(uuid) TO authenticated;

-- 2) RPC transacional para iniciar tarefa (chegou no local)
CREATE OR REPLACE FUNCTION public.iniciar_tarefa_servico(p_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_servico record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_AUTENTICADO',
      'mensagem', 'Sessão expirada. Faça login novamente.');
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PROFILE_NAO_ENCONTRADO',
      'mensagem', 'Seu perfil de profissional não foi encontrado.');
  END IF;

  SELECT id, status::text AS status, profissional_id
    INTO v_servico
    FROM public.servicos
   WHERE id = p_servico_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'SERVICO_NAO_ENCONTRADO',
      'mensagem', 'Esta tarefa não existe mais.');
  END IF;

  IF v_servico.profissional_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'SERVICO_SEM_PROFISSIONAL',
      'mensagem', 'Esta tarefa foi cancelada e não está mais disponível.');
  END IF;

  IF v_servico.profissional_id <> v_profile_id THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'SERVICO_REATRIBUIDO',
      'mensagem', 'Esta tarefa foi reatribuída a outro técnico.');
  END IF;

  IF v_servico.status NOT IN ('agendada','em_rota','em_andamento') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'STATUS_INVALIDO',
      'mensagem', 'Esta tarefa não pode mais ser iniciada (status atual: ' || v_servico.status || ').');
  END IF;

  IF v_servico.status = 'em_andamento' THEN
    RETURN jsonb_build_object('ok', true, 'codigo', 'JA_EM_ANDAMENTO',
      'mensagem', 'Tarefa já estava em andamento.');
  END IF;

  UPDATE public.servicos
     SET status = 'em_andamento',
         iniciada_em = now(),
         updated_at = now()
   WHERE id = p_servico_id
     AND profissional_id = v_profile_id
     AND status IN ('agendada','em_rota');

  RETURN jsonb_build_object('ok', true, 'codigo', 'OK',
    'mensagem', 'Tarefa iniciada.');
END;
$$;

REVOKE ALL ON FUNCTION public.iniciar_tarefa_servico(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.iniciar_tarefa_servico(uuid) TO authenticated;

-- 3) Mensagem mais clara no trigger de validação (sem mudar regra de negócio)
CREATE OR REPLACE FUNCTION public.validar_status_servico()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('em_rota', 'em_andamento') AND NEW.profissional_id IS NULL THEN
    RAISE EXCEPTION 'SERVICO_SEM_PROFISSIONAL: A tarefa precisa estar atribuída a um profissional para ir para o status "%".', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
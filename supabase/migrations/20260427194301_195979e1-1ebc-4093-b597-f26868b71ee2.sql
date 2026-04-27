-- 1) Melhorar liberar_servico_admin: fechar agendamento_base vinculado + mensagens claras
CREATE OR REPLACE FUNCTION public.liberar_servico_admin(_servico_id uuid, _motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _autorizado boolean := false;
  _servico record;
  _agendamentos_fechados int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _motivo IS NULL OR length(trim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo é obrigatório (mínimo 5 caracteres)';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('diretor','admin_master','desenvolvedor','coordenador_monitoramento')
  ) INTO _autorizado;

  IF NOT _autorizado THEN
    RAISE EXCEPTION 'Sem permissão para liberar serviço';
  END IF;

  SELECT id, status, profissional_id, instalacao_origem_id, vistoria_origem_id
  INTO _servico
  FROM public.servicos
  WHERE id = _servico_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado';
  END IF;

  IF _servico.status IN ('concluida','aprovada','reprovada','aprovada_ressalvas','cancelada') THEN
    RAISE EXCEPTION 'Serviço já está em status terminal (%). Não há nada para liberar.', _servico.status;
  END IF;

  IF _servico.status NOT IN ('agendada','em_rota','em_andamento','imprevisto_pendente','pendente','reagendada','nao_compareceu','em_analise') THEN
    RAISE EXCEPTION 'Status atual (%) não permite liberação manual. Verifique com o suporte.', _servico.status;
  END IF;

  UPDATE public.servicos
  SET
    status = 'cancelada'::status_servico,
    observacoes = COALESCE(NULLIF(observacoes,''), '') ||
      CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
      '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
      '] LIBERADO PELO ADMIN (' || _uid::text || '): ' || _motivo,
    updated_at = now()
  WHERE id = _servico_id;

  -- Fechar agendamentos_base vinculados (origem do serviço)
  IF _servico.instalacao_origem_id IS NOT NULL THEN
    UPDATE public.agendamentos_base
    SET status = 'cancelada', updated_at = now(),
        observacoes = COALESCE(NULLIF(observacoes,''), '') ||
          CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
          '[Liberado pelo admin] ' || _motivo
    WHERE id = _servico.instalacao_origem_id
      AND status NOT IN ('cancelada','concluida','aprovada','reprovada');
    GET DIAGNOSTICS _agendamentos_fechados = ROW_COUNT;
  END IF;

  IF _servico.vistoria_origem_id IS NOT NULL THEN
    UPDATE public.agendamentos_base
    SET status = 'cancelada', updated_at = now(),
        observacoes = COALESCE(NULLIF(observacoes,''), '') ||
          CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
          '[Liberado pelo admin] ' || _motivo
    WHERE id = _servico.vistoria_origem_id
      AND status NOT IN ('cancelada','concluida','aprovada','reprovada');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'servico_id', _servico_id,
    'profissional_liberado', _servico.profissional_id,
    'agendamentos_fechados', _agendamentos_fechados
  );
END;
$function$;

-- 2) Marcar todos os 6 abertos como em_tratamento
UPDATE public.error_reports
SET status = 'em_tratamento', tratado_em = now()
WHERE id IN (
  'b33d7038-caa1-4cae-8957-0859d6836b71',
  '2127cad7-a0bb-4d0a-8eec-343b0bf5553b',
  '43aaa131-8757-4134-8e68-4118e963fd4b',
  '0ab7e65c-317b-4987-8232-d03394f9d619',
  'a4ea4264-7e28-4201-aec3-ff12d8e44e19',
  '7813b9df-aab3-489b-a4a6-6eafa3575700'
) AND status = 'aberto';
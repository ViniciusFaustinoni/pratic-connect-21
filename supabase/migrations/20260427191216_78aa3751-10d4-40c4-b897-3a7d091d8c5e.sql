CREATE OR REPLACE FUNCTION public.concluir_servico_prestador_externo(
  _servico_id uuid,
  _local text,
  _data_execucao date,
  _executado_por text,
  _observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _autorizado boolean := false;
  _servico record;
  _texto_obs text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _local IS NULL OR length(trim(_local)) < 3 THEN
    RAISE EXCEPTION 'Local é obrigatório (mínimo 3 caracteres)';
  END IF;
  IF _data_execucao IS NULL THEN
    RAISE EXCEPTION 'Data de execução é obrigatória';
  END IF;
  IF _data_execucao > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data de execução não pode ser futura';
  END IF;
  IF _executado_por IS NULL OR length(trim(_executado_por)) < 3 THEN
    RAISE EXCEPTION 'Quem executou é obrigatório (mínimo 3 caracteres)';
  END IF;

  -- Autorização
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('diretor','admin_master','desenvolvedor','coordenador_monitoramento')
  ) INTO _autorizado;

  IF NOT _autorizado THEN
    RAISE EXCEPTION 'Sem permissão para concluir serviço por prestador externo';
  END IF;

  SELECT id, status, instalacao_origem_id, veiculo_id, associado_id
  INTO _servico
  FROM public.servicos
  WHERE id = _servico_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado';
  END IF;

  IF _servico.status IN ('concluida','cancelada') THEN
    RAISE EXCEPTION 'Serviço já está em status terminal (%)', _servico.status;
  END IF;

  _texto_obs :=
    '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
    '] CONCLUÍDO POR PRESTADOR EXTERNO (admin ' || _uid::text || E')\n' ||
    '• Local: ' || _local || E'\n' ||
    '• Data execução: ' || to_char(_data_execucao,'DD/MM/YYYY') || E'\n' ||
    '• Executado por: ' || _executado_por ||
    CASE WHEN _observacoes IS NOT NULL AND length(trim(_observacoes)) > 0
      THEN E'\n• Observações: ' || _observacoes
      ELSE ''
    END;

  UPDATE public.servicos
  SET
    status = 'concluida'::status_servico,
    concluida_em = now(),
    decisao_instalador = COALESCE(decisao_instalador, 'aprovado'),
    observacoes = COALESCE(NULLIF(observacoes,''), '') ||
      CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
      _texto_obs,
    updated_at = now()
  WHERE id = _servico_id;

  -- Sincroniza instalacao vinculada (mesmo padrão do fluxo aprovar)
  IF _servico.instalacao_origem_id IS NOT NULL THEN
    UPDATE public.instalacoes
    SET status = 'concluida',
        concluida_em = now(),
        updated_at = now()
    WHERE id = _servico.instalacao_origem_id
      AND status NOT IN ('concluida','cancelada');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'servico_id', _servico_id,
    'veiculo_id', _servico.veiculo_id,
    'associado_id', _servico.associado_id
  );
END;
$function$;
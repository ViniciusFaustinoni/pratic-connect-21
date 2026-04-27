
-- =========================================================
-- B1: Backfill — cancelar serviços fantasma (sem evolução)
-- =========================================================
WITH alvo AS (
  SELECT id
  FROM public.servicos
  WHERE status IN ('agendada','em_rota','em_andamento')
    AND data_agendada < CURRENT_DATE - INTERVAL '1 day'
    AND iniciada_em IS NULL
    AND concluida_em IS NULL
)
UPDATE public.servicos s
SET 
  status = 'cancelada'::status_servico,
  observacoes = COALESCE(NULLIF(s.observacoes,''), '') ||
    CASE WHEN COALESCE(s.observacoes,'') = '' THEN '' ELSE E'\n' END ||
    '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
    '] Cancelado automaticamente por inatividade — backfill (serviço fantasma travando agenda do técnico).',
  updated_at = now()
FROM alvo
WHERE s.id = alvo.id;

-- =========================================================
-- B2: RPC liberar_servico_admin
-- =========================================================
CREATE OR REPLACE FUNCTION public.liberar_servico_admin(
  _servico_id uuid,
  _motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _autorizado boolean := false;
  _servico record;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _motivo IS NULL OR length(trim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo é obrigatório (mínimo 5 caracteres)';
  END IF;

  -- Autorização: diretor, admin_master, desenvolvedor ou coordenador de monitoramento
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('diretor','admin_master','desenvolvedor','coordenador_monitoramento')
  ) INTO _autorizado;

  IF NOT _autorizado THEN
    RAISE EXCEPTION 'Sem permissão para liberar serviço';
  END IF;

  SELECT id, status, profissional_id INTO _servico
  FROM public.servicos
  WHERE id = _servico_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado';
  END IF;

  IF _servico.status NOT IN ('agendada','em_rota','em_andamento','imprevisto_pendente') THEN
    RAISE EXCEPTION 'Serviço já está em status terminal (%)', _servico.status;
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

  RETURN jsonb_build_object(
    'ok', true,
    'servico_id', _servico_id,
    'profissional_liberado', _servico.profissional_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.liberar_servico_admin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.liberar_servico_admin(uuid, text) TO authenticated;


-- =====================================================================
-- 1) GUARD: solicitacoes_troca_titularidade não pode entrar em
--    aguardando_vistoria/aguardando_manutencao sem servico vivo.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_guard_troca_status_exige_servico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servico_status status_servico;
BEGIN
  -- Só age em transições para os dois status que exigem serviço materializado
  -- (ou quando o ponteiro do serviço muda nesses status).
  IF NEW.status = 'aguardando_vistoria' AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.servico_vistoria_id IS DISTINCT FROM NEW.servico_vistoria_id
     ) THEN
    IF NEW.servico_vistoria_id IS NULL THEN
      RAISE EXCEPTION
        'Troca de titularidade % nao pode ir para aguardando_vistoria sem servico_vistoria_id (use a edge aprovar-troca-monitoramento, acao=solicitar_vistoria/solicitar_retirada).',
        NEW.id
        USING ERRCODE = 'check_violation',
              HINT = 'Materialize o servico de campo na mesma transacao.';
    END IF;
    SELECT status INTO v_servico_status FROM public.servicos WHERE id = NEW.servico_vistoria_id;
    IF v_servico_status IS NULL THEN
      RAISE EXCEPTION
        'Troca % aponta para servico_vistoria_id % inexistente.', NEW.id, NEW.servico_vistoria_id
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_servico_status = 'cancelada' THEN
      RAISE EXCEPTION
        'Troca % aponta para servico_vistoria_id % cancelado.', NEW.id, NEW.servico_vistoria_id
        USING ERRCODE = 'check_violation',
              HINT = 'Re-materialize o servico antes de manter a solicitacao em aguardando_vistoria.';
    END IF;
  END IF;

  IF NEW.status = 'aguardando_manutencao' AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.servico_manutencao_id IS DISTINCT FROM NEW.servico_manutencao_id
     ) THEN
    IF NEW.servico_manutencao_id IS NULL THEN
      RAISE EXCEPTION
        'Troca % nao pode ir para aguardando_manutencao sem servico_manutencao_id.', NEW.id
        USING ERRCODE = 'check_violation',
              HINT = 'Materialize o servico de manutencao na mesma transacao.';
    END IF;
    SELECT status INTO v_servico_status FROM public.servicos WHERE id = NEW.servico_manutencao_id;
    IF v_servico_status IS NULL THEN
      RAISE EXCEPTION 'Troca % aponta para servico_manutencao_id % inexistente.', NEW.id, NEW.servico_manutencao_id
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_servico_status = 'cancelada' THEN
      RAISE EXCEPTION 'Troca % aponta para servico_manutencao_id % cancelado.', NEW.id, NEW.servico_manutencao_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_troca_status_exige_servico ON public.solicitacoes_troca_titularidade;
CREATE TRIGGER trg_guard_troca_status_exige_servico
  BEFORE INSERT OR UPDATE OF status, servico_vistoria_id, servico_manutencao_id
  ON public.solicitacoes_troca_titularidade
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_troca_status_exige_servico();

-- =====================================================================
-- 2) Detector reutilizado pela UI e pelo cron.
--    Retorna solicitações em aguardando_vistoria/aguardando_manutencao
--    sem serviço vivo (NULL, inexistente ou cancelada).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_detectar_troca_limbo(p_min_idade_minutos integer DEFAULT 0)
RETURNS TABLE (
  solicitacao_id uuid,
  veiculo_id uuid,
  placa text,
  status status_troca_titularidade,
  servico_id uuid,
  servico_status text,
  motivo text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.veiculo_id,
    v.placa,
    s.status,
    CASE WHEN s.status='aguardando_vistoria' THEN s.servico_vistoria_id ELSE s.servico_manutencao_id END,
    COALESCE(sv.status::text, 'inexistente'),
    CASE
      WHEN s.status='aguardando_vistoria'   AND s.servico_vistoria_id   IS NULL THEN 'servico_vistoria_id_null'
      WHEN s.status='aguardando_manutencao' AND s.servico_manutencao_id IS NULL THEN 'servico_manutencao_id_null'
      WHEN sv.id IS NULL THEN 'servico_inexistente'
      WHEN sv.status='cancelada' THEN 'servico_cancelado'
      ELSE 'desconhecido'
    END,
    s.updated_at
  FROM public.solicitacoes_troca_titularidade s
  LEFT JOIN public.veiculos v ON v.id = s.veiculo_id
  LEFT JOIN public.servicos sv
    ON sv.id = CASE WHEN s.status='aguardando_vistoria' THEN s.servico_vistoria_id ELSE s.servico_manutencao_id END
  WHERE s.status IN ('aguardando_vistoria','aguardando_manutencao')
    AND s.updated_at < (now() - make_interval(mins => p_min_idade_minutos))
    AND (
         (s.status='aguardando_vistoria'   AND (s.servico_vistoria_id   IS NULL OR sv.id IS NULL OR sv.status='cancelada'))
      OR (s.status='aguardando_manutencao' AND (s.servico_manutencao_id IS NULL OR sv.id IS NULL OR sv.status='cancelada'))
    );
$$;

GRANT EXECUTE ON FUNCTION public.fn_detectar_troca_limbo(integer) TO authenticated, service_role;

-- =====================================================================
-- 3) Reconciliador (chamado pelo cron a cada 15 min).
--    Não tenta re-materializar (endereço não está persistido na solicitação);
--    apenas notifica o Monitoramento, dedup 1h por solicitação,
--    e loga em logs_auditoria com prefixo [reconcilia_troca_limbo].
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_reconciliar_troca_titularidade_limbo()
RETURNS TABLE (notificadas integer, detectadas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_dedup boolean;
  v_notificadas integer := 0;
  v_detectadas integer := 0;
BEGIN
  FOR v_row IN SELECT * FROM public.fn_detectar_troca_limbo(15) LOOP
    v_detectadas := v_detectadas + 1;

    -- dedup 1h por solicitação
    SELECT EXISTS(
      SELECT 1 FROM public.notificacoes_sistema
      WHERE tipo = 'troca_limbo_pos_monitoramento'
        AND (dados->>'solicitacao_id') = v_row.solicitacao_id::text
        AND created_at > now() - interval '1 hour'
    ) INTO v_dedup;

    IF NOT v_dedup THEN
      INSERT INTO public.notificacoes_sistema (
        tipo, destino_role, titulo, mensagem, dados, created_at
      ) VALUES (
        'troca_limbo_pos_monitoramento',
        'monitoramento',
        'Troca em limbo: serviço não materializado',
        format('Solicitação %s (placa %s) está em %s há mais de 15 min sem serviço vivo (%s).',
               v_row.solicitacao_id, COALESCE(v_row.placa,'?'), v_row.status, v_row.motivo),
        jsonb_build_object(
          'solicitacao_id', v_row.solicitacao_id,
          'veiculo_id',     v_row.veiculo_id,
          'placa',          v_row.placa,
          'status',         v_row.status,
          'motivo',         v_row.motivo,
          'servico_id',     v_row.servico_id,
          'servico_status', v_row.servico_status
        ),
        now()
      );
      v_notificadas := v_notificadas + 1;

      INSERT INTO public.logs_auditoria (
        usuario_id, usuario_nome, acao, modulo, descricao, tabela, registro_id, dados_novos
      ) VALUES (
        NULL, 'Sistema', 'criar', 'monitoramento',
        format('[reconcilia_troca_limbo] solicitacao=%s placa=%s motivo=%s',
               v_row.solicitacao_id, COALESCE(v_row.placa,'?'), v_row.motivo),
        'solicitacoes_troca_titularidade', v_row.solicitacao_id,
        jsonb_build_object('status', v_row.status, 'motivo', v_row.motivo,
                           'servico_id', v_row.servico_id, 'servico_status', v_row.servico_status)
      );
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_notificadas, v_detectadas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_reconciliar_troca_titularidade_limbo() TO authenticated, service_role;

-- =====================================================================
-- 4) Cron 15 min (idempotente: remove agendamento anterior se existir)
-- =====================================================================
DO $$
DECLARE v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'reconciliar-troca-titularidade-limbo';
  IF v_job_id IS NOT NULL THEN PERFORM cron.unschedule(v_job_id); END IF;
  PERFORM cron.schedule(
    'reconciliar-troca-titularidade-limbo',
    '*/15 * * * *',
    $cron$ SELECT public.fn_reconciliar_troca_titularidade_limbo(); $cron$
  );
END $$;

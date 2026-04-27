-- =====================================================================
-- 1. CAMPOS DE HISTÓRICO
-- =====================================================================

ALTER TABLE public.instalacoes
  ADD COLUMN IF NOT EXISTS historico_datas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS agendamento_anterior_id uuid NULL REFERENCES public.instalacoes(id) ON DELETE SET NULL;

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS historico_datas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS agendamento_anterior_id uuid NULL REFERENCES public.servicos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_instalacoes_associado_veiculo_status
  ON public.instalacoes (associado_id, veiculo_id, status);

CREATE INDEX IF NOT EXISTS idx_servicos_associado_veiculo_tipo_status
  ON public.servicos (associado_id, veiculo_id, tipo, status);

-- =====================================================================
-- 2. TRIGGER DE DEDUPE EM INSTALACOES
-- =====================================================================

CREATE OR REPLACE FUNCTION public.dedupe_instalacoes_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old RECORD;
  v_count int := 0;
  v_historico_anterior jsonb;
BEGIN
  IF NEW.associado_id IS NULL OR NEW.veiculo_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Para cada instalação anterior viva do mesmo (associado, veiculo)
  FOR v_old IN
    SELECT id, data_agendada, hora_agendada, periodo, status, historico_datas
      FROM public.instalacoes
     WHERE id <> NEW.id
       AND associado_id = NEW.associado_id
       AND veiculo_id   = NEW.veiculo_id
       AND status::text NOT IN ('concluida','cancelada','aprovada')
  LOOP
    v_count := v_count + 1;

    -- Concatenar histórico antigo + entrada da própria data antiga
    v_historico_anterior := COALESCE(v_old.historico_datas, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
           'instalacao_id', v_old.id,
           'data_anterior', v_old.data_agendada,
           'hora_anterior', v_old.hora_agendada,
           'periodo_anterior', v_old.periodo,
           'status_anterior', v_old.status,
           'cancelada_em', now(),
           'motivo', 'Substituída por nova instalação ' || NEW.id::text
         ));

    -- Cancela a antiga
    UPDATE public.instalacoes
       SET status = 'cancelada'::status_instalacao,
           observacoes = COALESCE(observacoes,'') ||
             E'\n[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
             '] Cancelada automaticamente: substituída pela instalação ' || NEW.id::text || '.',
           updated_at = now()
     WHERE id = v_old.id;

    -- Anexa ao histórico da NOVA instalação
    UPDATE public.instalacoes
       SET historico_datas = COALESCE(historico_datas,'[]'::jsonb) || v_historico_anterior,
           agendamento_anterior_id = COALESCE(agendamento_anterior_id, v_old.id),
           updated_at = now()
     WHERE id = NEW.id;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE '[dedupe_instalacoes_on_insert] % instalações antigas canceladas para associado %, veiculo %',
      v_count, NEW.associado_id, NEW.veiculo_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dedupe_instalacoes_on_insert ON public.instalacoes;
CREATE TRIGGER trg_dedupe_instalacoes_on_insert
AFTER INSERT ON public.instalacoes
FOR EACH ROW
EXECUTE FUNCTION public.dedupe_instalacoes_on_insert();

-- =====================================================================
-- 3. TRIGGER DE DEDUPE EM SERVICOS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.dedupe_servicos_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old RECORD;
  v_count int := 0;
  v_historico_anterior jsonb;
BEGIN
  IF NEW.associado_id IS NULL OR NEW.veiculo_id IS NULL OR NEW.tipo IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_old IN
    SELECT id, data_agendada, hora_agendada, periodo, status, historico_datas
      FROM public.servicos
     WHERE id <> NEW.id
       AND associado_id = NEW.associado_id
       AND veiculo_id   = NEW.veiculo_id
       AND tipo         = NEW.tipo
       AND status::text NOT IN ('concluida','cancelada','aprovada','aprovada_ressalvas','reprovada')
  LOOP
    v_count := v_count + 1;

    v_historico_anterior := COALESCE(v_old.historico_datas, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
           'servico_id', v_old.id,
           'data_anterior', v_old.data_agendada,
           'hora_anterior', v_old.hora_agendada,
           'periodo_anterior', v_old.periodo,
           'status_anterior', v_old.status,
           'cancelada_em', now(),
           'motivo', 'Substituída por novo serviço ' || NEW.id::text
         ));

    UPDATE public.servicos
       SET status = 'cancelada',
           observacoes = COALESCE(observacoes,'') ||
             E'\n[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
             '] Cancelado automaticamente: substituído pelo serviço ' || NEW.id::text || '.',
           updated_at = now()
     WHERE id = v_old.id;

    UPDATE public.servicos
       SET historico_datas = COALESCE(historico_datas,'[]'::jsonb) || v_historico_anterior,
           agendamento_anterior_id = COALESCE(agendamento_anterior_id, v_old.id),
           updated_at = now()
     WHERE id = NEW.id;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE '[dedupe_servicos_on_insert] % serviços antigos cancelados para associado %, veiculo %, tipo %',
      v_count, NEW.associado_id, NEW.veiculo_id, NEW.tipo;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dedupe_servicos_on_insert ON public.servicos;
CREATE TRIGGER trg_dedupe_servicos_on_insert
AFTER INSERT ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.dedupe_servicos_on_insert();

-- =====================================================================
-- 4. LIMPEZA RETROATIVA — INSTALACOES
-- =====================================================================

DO $$
DECLARE
  v_grupo RECORD;
  v_keeper_id uuid;
  v_old RECORD;
  v_historico_acumulado jsonb;
  v_grupos_processados int := 0;
  v_canceladas int := 0;
BEGIN
  FOR v_grupo IN
    SELECT associado_id, veiculo_id
      FROM public.instalacoes
     WHERE associado_id IS NOT NULL
       AND veiculo_id IS NOT NULL
       AND status::text NOT IN ('concluida','cancelada','aprovada')
     GROUP BY associado_id, veiculo_id
    HAVING COUNT(*) > 1
  LOOP
    v_grupos_processados := v_grupos_processados + 1;

    -- Mantém a mais recente
    SELECT id INTO v_keeper_id
      FROM public.instalacoes
     WHERE associado_id = v_grupo.associado_id
       AND veiculo_id   = v_grupo.veiculo_id
       AND status::text NOT IN ('concluida','cancelada','aprovada')
     ORDER BY created_at DESC, id DESC
     LIMIT 1;

    v_historico_acumulado := '[]'::jsonb;

    FOR v_old IN
      SELECT id, data_agendada, hora_agendada, periodo, status, historico_datas
        FROM public.instalacoes
       WHERE associado_id = v_grupo.associado_id
         AND veiculo_id   = v_grupo.veiculo_id
         AND status::text NOT IN ('concluida','cancelada','aprovada')
         AND id <> v_keeper_id
    LOOP
      v_canceladas := v_canceladas + 1;

      v_historico_acumulado := v_historico_acumulado
        || COALESCE(v_old.historico_datas, '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
             'instalacao_id', v_old.id,
             'data_anterior', v_old.data_agendada,
             'hora_anterior', v_old.hora_agendada,
             'periodo_anterior', v_old.periodo,
             'status_anterior', v_old.status,
             'cancelada_em', now(),
             'motivo', 'Limpeza retroativa: duplicidade detectada'
           ));

      UPDATE public.instalacoes
         SET status = 'cancelada'::status_instalacao,
             observacoes = COALESCE(observacoes,'') ||
               E'\n[LIMPEZA AUTOMÁTICA] Cancelada por duplicidade. Mantida: ' || v_keeper_id::text,
             updated_at = now()
       WHERE id = v_old.id;
    END LOOP;

    UPDATE public.instalacoes
       SET historico_datas = COALESCE(historico_datas,'[]'::jsonb) || v_historico_acumulado,
           updated_at = now()
     WHERE id = v_keeper_id;
  END LOOP;

  RAISE NOTICE '[LIMPEZA INSTALACOES] grupos: %, canceladas: %', v_grupos_processados, v_canceladas;
END $$;

-- =====================================================================
-- 5. LIMPEZA RETROATIVA — SERVICOS
-- =====================================================================

DO $$
DECLARE
  v_grupo RECORD;
  v_keeper_id uuid;
  v_old RECORD;
  v_historico_acumulado jsonb;
  v_grupos_processados int := 0;
  v_cancelados int := 0;
BEGIN
  FOR v_grupo IN
    SELECT associado_id, veiculo_id, tipo
      FROM public.servicos
     WHERE associado_id IS NOT NULL
       AND veiculo_id IS NOT NULL
       AND tipo IS NOT NULL
       AND status::text NOT IN ('concluida','cancelada','aprovada','aprovada_ressalvas','reprovada')
     GROUP BY associado_id, veiculo_id, tipo
    HAVING COUNT(*) > 1
  LOOP
    v_grupos_processados := v_grupos_processados + 1;

    SELECT id INTO v_keeper_id
      FROM public.servicos
     WHERE associado_id = v_grupo.associado_id
       AND veiculo_id   = v_grupo.veiculo_id
       AND tipo         = v_grupo.tipo
       AND status::text NOT IN ('concluida','cancelada','aprovada','aprovada_ressalvas','reprovada')
     ORDER BY created_at DESC, id DESC
     LIMIT 1;

    v_historico_acumulado := '[]'::jsonb;

    FOR v_old IN
      SELECT id, data_agendada, hora_agendada, periodo, status, historico_datas
        FROM public.servicos
       WHERE associado_id = v_grupo.associado_id
         AND veiculo_id   = v_grupo.veiculo_id
         AND tipo         = v_grupo.tipo
         AND status::text NOT IN ('concluida','cancelada','aprovada','aprovada_ressalvas','reprovada')
         AND id <> v_keeper_id
    LOOP
      v_cancelados := v_cancelados + 1;

      v_historico_acumulado := v_historico_acumulado
        || COALESCE(v_old.historico_datas, '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
             'servico_id', v_old.id,
             'data_anterior', v_old.data_agendada,
             'hora_anterior', v_old.hora_agendada,
             'periodo_anterior', v_old.periodo,
             'status_anterior', v_old.status,
             'cancelada_em', now(),
             'motivo', 'Limpeza retroativa: duplicidade detectada'
           ));

      UPDATE public.servicos
         SET status = 'cancelada',
             observacoes = COALESCE(observacoes,'') ||
               E'\n[LIMPEZA AUTOMÁTICA] Cancelado por duplicidade. Mantido: ' || v_keeper_id::text,
             updated_at = now()
       WHERE id = v_old.id;
    END LOOP;

    UPDATE public.servicos
       SET historico_datas = COALESCE(historico_datas,'[]'::jsonb) || v_historico_acumulado,
           updated_at = now()
     WHERE id = v_keeper_id;
  END LOOP;

  RAISE NOTICE '[LIMPEZA SERVICOS] grupos: %, cancelados: %', v_grupos_processados, v_cancelados;
END $$;
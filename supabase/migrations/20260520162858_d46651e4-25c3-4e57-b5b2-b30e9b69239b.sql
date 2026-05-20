
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS dedup_substituido_por uuid NULL
    REFERENCES public.servicos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_servicos_dedup_substituido_por
  ON public.servicos(dedup_substituido_por)
  WHERE dedup_substituido_por IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_no_resurrect_dedup_servicos()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.dedup_substituido_por IS NOT NULL
     AND NEW.dedup_substituido_por IS NULL THEN
    RAISE EXCEPTION 'servico % está marcado como duplicata; dedup_substituido_por não pode voltar a NULL', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_no_resurrect_dedup ON public.servicos;
CREATE TRIGGER trg_no_resurrect_dedup
  BEFORE UPDATE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.fn_no_resurrect_dedup_servicos();

-- Cleanup com triggers conflitantes desabilitadas
ALTER TABLE public.servicos DISABLE TRIGGER trg_guard_autovistoria_servico_disjunto;
ALTER TABLE public.servicos DISABLE TRIGGER trg_guard_servico_autovistoria_concluida;
ALTER TABLE public.servicos DISABLE TRIGGER trg_bloquear_servico_se_terminal;
ALTER TABLE public.servicos DISABLE TRIGGER trg_bloqueio_data_servicos;
ALTER TABLE public.servicos DISABLE TRIGGER trigger_validar_status_servico;

WITH ranked AS (
  SELECT id, instalacao_origem_id,
    ROW_NUMBER() OVER (
      PARTITION BY instalacao_origem_id
      ORDER BY
        CASE
          WHEN status::text IN ('em_analise','agendada','em_andamento','pendente','em_rota','reagendada','imprevisto_pendente') THEN 1
          WHEN status::text IN ('concluida','aprovada','aprovada_ressalvas') THEN 2
          ELSE 3
        END,
        created_at DESC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY instalacao_origem_id
      ORDER BY
        CASE
          WHEN status::text IN ('em_analise','agendada','em_andamento','pendente','em_rota','reagendada','imprevisto_pendente') THEN 1
          WHEN status::text IN ('concluida','aprovada','aprovada_ressalvas') THEN 2
          ELSE 3
        END,
        created_at DESC
    ) AS keeper_id
  FROM public.servicos
  WHERE instalacao_origem_id IS NOT NULL AND dedup_substituido_por IS NULL
)
UPDATE public.servicos s
SET dedup_substituido_por = r.keeper_id,
    observacoes = '[DEDUP→' || r.keeper_id::text || '] ' || COALESCE(s.observacoes, ''),
    updated_at = now()
FROM ranked r
WHERE s.id = r.id AND r.rn > 1 AND r.keeper_id IS NOT NULL AND s.id <> r.keeper_id;

WITH ranked AS (
  SELECT id, vistoria_origem_id,
    ROW_NUMBER() OVER (
      PARTITION BY vistoria_origem_id
      ORDER BY
        CASE
          WHEN status::text IN ('em_analise','agendada','em_andamento','pendente','em_rota','reagendada','imprevisto_pendente') THEN 1
          WHEN status::text IN ('concluida','aprovada','aprovada_ressalvas') THEN 2
          ELSE 3
        END,
        created_at DESC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY vistoria_origem_id
      ORDER BY
        CASE
          WHEN status::text IN ('em_analise','agendada','em_andamento','pendente','em_rota','reagendada','imprevisto_pendente') THEN 1
          WHEN status::text IN ('concluida','aprovada','aprovada_ressalvas') THEN 2
          ELSE 3
        END,
        created_at DESC
    ) AS keeper_id
  FROM public.servicos
  WHERE vistoria_origem_id IS NOT NULL AND dedup_substituido_por IS NULL
)
UPDATE public.servicos s
SET dedup_substituido_por = r.keeper_id,
    observacoes = '[DEDUP→' || r.keeper_id::text || '] ' || COALESCE(s.observacoes, ''),
    updated_at = now()
FROM ranked r
WHERE s.id = r.id AND r.rn > 1 AND r.keeper_id IS NOT NULL AND s.id <> r.keeper_id;

ALTER TABLE public.servicos ENABLE TRIGGER trg_guard_autovistoria_servico_disjunto;
ALTER TABLE public.servicos ENABLE TRIGGER trg_guard_servico_autovistoria_concluida;
ALTER TABLE public.servicos ENABLE TRIGGER trg_bloquear_servico_se_terminal;
ALTER TABLE public.servicos ENABLE TRIGGER trg_bloqueio_data_servicos;
ALTER TABLE public.servicos ENABLE TRIGGER trigger_validar_status_servico;

-- Índices canônicos
DROP INDEX IF EXISTS public.uq_servicos_instalacao_origem_vivo;
DROP INDEX IF EXISTS public.uq_servicos_vistoria_origem_vivo;

CREATE UNIQUE INDEX uq_servicos_instalacao_origem_canonico
  ON public.servicos (instalacao_origem_id)
  WHERE instalacao_origem_id IS NOT NULL
    AND dedup_substituido_por IS NULL
    AND status NOT IN ('cancelada','reprovada','nao_compareceu');

CREATE UNIQUE INDEX uq_servicos_vistoria_origem_canonico
  ON public.servicos (vistoria_origem_id)
  WHERE vistoria_origem_id IS NOT NULL
    AND dedup_substituido_por IS NULL
    AND status NOT IN ('cancelada','reprovada','nao_compareceu');

-- Trigger dedupe estendida
CREATE OR REPLACE FUNCTION public.dedupe_servicos_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_old RECORD;
  v_count int := 0;
  v_historico_anterior jsonb;
  v_tipo_canonico text;
BEGIN
  IF NEW.dedup_substituido_por IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.associado_id IS NULL OR NEW.veiculo_id IS NULL OR NEW.tipo IS NULL THEN
    RETURN NEW;
  END IF;

  v_tipo_canonico := CASE
    WHEN NEW.tipo::text IN ('vistoria_entrada','instalacao') THEN 'INST_OR_VE'
    ELSE NEW.tipo::text
  END;

  FOR v_old IN
    SELECT id, data_agendada, hora_agendada, periodo, status, historico_datas
      FROM public.servicos
     WHERE id <> NEW.id
       AND associado_id = NEW.associado_id
       AND veiculo_id   = NEW.veiculo_id
       AND dedup_substituido_por IS NULL
       AND status::text NOT IN ('concluida','cancelada','aprovada','aprovada_ressalvas','reprovada','nao_compareceu')
       AND (
         tipo = NEW.tipo
         OR (v_tipo_canonico = 'INST_OR_VE' AND tipo::text IN ('vistoria_entrada','instalacao'))
         OR (NEW.instalacao_origem_id IS NOT NULL AND instalacao_origem_id = NEW.instalacao_origem_id)
         OR (NEW.vistoria_origem_id  IS NOT NULL AND vistoria_origem_id  = NEW.vistoria_origem_id)
       )
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
    RAISE NOTICE '[dedupe_servicos_on_insert] % serviços antigos cancelados',  v_count;
  END IF;
  RETURN NEW;
END;
$function$;

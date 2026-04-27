-- 1. Novo status "descartado"
ALTER TYPE public.error_report_status ADD VALUE IF NOT EXISTS 'descartado';

-- 2. Colunas de auditoria de descarte
ALTER TABLE public.error_reports
  ADD COLUMN IF NOT EXISTS descartado_em timestamptz,
  ADD COLUMN IF NOT EXISTS descartado_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_descarte text;

-- 3. Tabela de histórico
CREATE TABLE IF NOT EXISTS public.error_report_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.error_reports(id) ON DELETE CASCADE,
  from_status public.error_report_status,
  to_status public.error_report_status NOT NULL,
  changed_by uuid,
  changed_by_nome text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_report_history_report ON public.error_report_history(report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_report_history_user ON public.error_report_history(changed_by);

ALTER TABLE public.error_report_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select history admin or autor" ON public.error_report_history;
CREATE POLICY "select history admin or autor"
ON public.error_report_history
FOR SELECT
USING (
  public.is_error_reports_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.error_reports r
    WHERE r.id = error_report_history.report_id
      AND r.reporter_id = auth.uid()
  )
);

-- Sem policy de INSERT/UPDATE/DELETE: somente SECURITY DEFINER triggers podem escrever.

-- 4. Função e trigger de log
CREATE OR REPLACE FUNCTION public.log_error_report_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_actor_nome text;
  v_obs text;
BEGIN
  v_actor := auth.uid();

  SELECT nome INTO v_actor_nome FROM public.profiles WHERE user_id = v_actor LIMIT 1;
  IF v_actor_nome IS NULL THEN
    SELECT nome INTO v_actor_nome FROM public.profiles WHERE id = v_actor LIMIT 1;
  END IF;

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.error_report_history(report_id, from_status, to_status, changed_by, changed_by_nome, observacao)
    VALUES (NEW.id, NULL, NEW.status, NEW.reporter_id, NEW.reporter_nome, 'Relato criado');
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') AND (NEW.status IS DISTINCT FROM OLD.status) THEN
    -- escolhe a melhor observação contextual
    v_obs := CASE
      WHEN NEW.status = 'descartado' THEN COALESCE(NEW.motivo_descarte, NEW.observacao_diretor)
      ELSE NEW.observacao_diretor
    END;

    INSERT INTO public.error_report_history(report_id, from_status, to_status, changed_by, changed_by_nome, observacao)
    VALUES (NEW.id, OLD.status, NEW.status, v_actor, v_actor_nome, v_obs);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_error_report_status_insert ON public.error_reports;
CREATE TRIGGER trg_log_error_report_status_insert
AFTER INSERT ON public.error_reports
FOR EACH ROW EXECUTE FUNCTION public.log_error_report_status_change();

DROP TRIGGER IF EXISTS trg_log_error_report_status_update ON public.error_reports;
CREATE TRIGGER trg_log_error_report_status_update
AFTER UPDATE OF status ON public.error_reports
FOR EACH ROW EXECUTE FUNCTION public.log_error_report_status_change();

-- 5. Backfill: registrar evento "criado" para relatos pré-existentes que não tenham histórico
INSERT INTO public.error_report_history(report_id, from_status, to_status, changed_by, changed_by_nome, observacao, created_at)
SELECT r.id, NULL, 'aberto'::public.error_report_status, r.reporter_id, r.reporter_nome, 'Relato criado (backfill)', r.created_at
FROM public.error_reports r
WHERE NOT EXISTS (SELECT 1 FROM public.error_report_history h WHERE h.report_id = r.id);
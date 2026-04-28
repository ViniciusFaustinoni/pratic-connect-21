-- Helper: associado em estado terminal/bloqueado para finalização operacional
CREATE OR REPLACE FUNCTION public.fn_associado_em_estado_terminal(_associado_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status::text
  FROM public.associados
  WHERE id = _associado_id
    AND status::text IN ('cancelado','cancelamento_solicitado','recusado','inadimplente_terminal','suspenso')
  LIMIT 1;
$$;

-- =========================
-- Trigger: instalacoes
-- =========================
CREATE OR REPLACE FUNCTION public.trg_bloquear_instalacao_se_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  -- Só bloqueia transição PARA concluida
  IF NEW.status::text = 'concluida' AND COALESCE(OLD.status::text,'') <> 'concluida' THEN
    v_status := public.fn_associado_em_estado_terminal(NEW.associado_id);
    IF v_status IS NOT NULL THEN
      RAISE EXCEPTION 'Não é possível concluir instalação: associado está em status "%"', v_status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_instalacao_se_terminal ON public.instalacoes;
CREATE TRIGGER trg_bloquear_instalacao_se_terminal
BEFORE UPDATE ON public.instalacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_bloquear_instalacao_se_terminal();

-- =========================
-- Trigger: vistorias
-- =========================
CREATE OR REPLACE FUNCTION public.trg_bloquear_vistoria_se_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.status::text IN ('aprovada','concluida') AND COALESCE(OLD.status::text,'') <> NEW.status::text THEN
    IF NEW.associado_id IS NOT NULL THEN
      v_status := public.fn_associado_em_estado_terminal(NEW.associado_id);
      IF v_status IS NOT NULL THEN
        RAISE EXCEPTION 'Não é possível aprovar vistoria: associado está em status "%"', v_status
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_vistoria_se_terminal ON public.vistorias;
CREATE TRIGGER trg_bloquear_vistoria_se_terminal
BEFORE UPDATE ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION public.trg_bloquear_vistoria_se_terminal();

-- =========================
-- Trigger: servicos
-- =========================
CREATE OR REPLACE FUNCTION public.trg_bloquear_servico_se_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.status::text IN ('concluida','aprovada') AND COALESCE(OLD.status::text,'') <> NEW.status::text THEN
    IF NEW.associado_id IS NOT NULL THEN
      v_status := public.fn_associado_em_estado_terminal(NEW.associado_id);
      IF v_status IS NOT NULL THEN
        RAISE EXCEPTION 'Não é possível concluir serviço: associado está em status "%"', v_status
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_servico_se_terminal ON public.servicos;
CREATE TRIGGER trg_bloquear_servico_se_terminal
BEFORE UPDATE ON public.servicos
FOR EACH ROW EXECUTE FUNCTION public.trg_bloquear_servico_se_terminal();
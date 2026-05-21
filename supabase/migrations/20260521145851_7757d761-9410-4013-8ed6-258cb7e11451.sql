-- Adiciona colunas de auditoria de cancelamento em public.servicos
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid;

CREATE OR REPLACE FUNCTION public.fn_servicos_set_cancelado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelada'
     AND (OLD.status IS DISTINCT FROM 'cancelada')
     AND NEW.cancelado_em IS NULL THEN
    NEW.cancelado_em := now();
    IF NEW.cancelado_por IS NULL THEN
      BEGIN
        NEW.cancelado_por := auth.uid();
      EXCEPTION WHEN OTHERS THEN
        NEW.cancelado_por := NULL;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_servicos_set_cancelado_em ON public.servicos;
CREATE TRIGGER trg_servicos_set_cancelado_em
BEFORE UPDATE ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.fn_servicos_set_cancelado_em();
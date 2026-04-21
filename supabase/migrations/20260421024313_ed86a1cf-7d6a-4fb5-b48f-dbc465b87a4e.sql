-- Fase 2: Trigger de integridade em servicos
CREATE OR REPLACE FUNCTION public.servicos_garantir_concluida_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Auto-preencher concluida_em quando status muda para 'concluida'
  IF NEW.status = 'concluida' AND NEW.concluida_em IS NULL THEN
    NEW.concluida_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_servicos_garantir_concluida_em ON public.servicos;
CREATE TRIGGER trg_servicos_garantir_concluida_em
BEFORE INSERT OR UPDATE ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.servicos_garantir_concluida_em();

-- Backfill: registros concluídos sem concluida_em
UPDATE public.servicos
SET concluida_em = updated_at
WHERE status = 'concluida' AND concluida_em IS NULL;
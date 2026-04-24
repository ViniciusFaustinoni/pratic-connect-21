CREATE TABLE IF NOT EXISTS public.sga_runtime_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backfill_financeiro_ativo boolean NOT NULL DEFAULT false,
  backfill_iniciado_em timestamptz,
  backfill_expira_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sga_runtime_state (backfill_financeiro_ativo)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM public.sga_runtime_state);

ALTER TABLE public.sga_runtime_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Diretores podem gerenciar runtime state" ON public.sga_runtime_state;
CREATE POLICY "Diretores podem gerenciar runtime state"
ON public.sga_runtime_state
FOR ALL
USING (has_role(auth.uid(), 'diretor'::app_role))
WITH CHECK (has_role(auth.uid(), 'diretor'::app_role));

DROP POLICY IF EXISTS "Service role acesso total" ON public.sga_runtime_state;
CREATE POLICY "Service role acesso total"
ON public.sga_runtime_state
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.sga_runtime_state_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sga_runtime_state_touch ON public.sga_runtime_state;
CREATE TRIGGER trg_sga_runtime_state_touch
BEFORE UPDATE ON public.sga_runtime_state
FOR EACH ROW EXECUTE FUNCTION public.sga_runtime_state_touch();
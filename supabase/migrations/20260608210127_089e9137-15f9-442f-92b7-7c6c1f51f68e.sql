ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS bypass_aplicado jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_contratos_bypass_aplicado
  ON public.contratos USING gin (bypass_aplicado);
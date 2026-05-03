-- Phase 2: unified executor for evento inspections
ALTER TABLE public.vistorias_evento
  ADD COLUMN IF NOT EXISTS executor_tipo text,
  ADD COLUMN IF NOT EXISTS executor_id uuid;

-- Constraint: tipo válido
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vistorias_evento_executor_tipo_check'
  ) THEN
    ALTER TABLE public.vistorias_evento
      ADD CONSTRAINT vistorias_evento_executor_tipo_check
      CHECK (executor_tipo IS NULL OR executor_tipo IN ('regulador','tecnico_interno','prestador_externo'));
  END IF;
END$$;

-- Backfill: registros que já têm regulador_id viram tipo 'regulador'
UPDATE public.vistorias_evento
SET executor_tipo = 'regulador',
    executor_id = regulador_id
WHERE regulador_id IS NOT NULL AND executor_tipo IS NULL;

CREATE INDEX IF NOT EXISTS idx_vistorias_evento_executor
  ON public.vistorias_evento (executor_tipo, executor_id);
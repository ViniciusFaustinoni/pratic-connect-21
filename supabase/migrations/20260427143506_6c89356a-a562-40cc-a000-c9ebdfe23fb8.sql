ALTER TABLE public.error_reports
  ADD COLUMN IF NOT EXISTS eh_retratamento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vezes_retratado integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_motivo_retratamento text,
  ADD COLUMN IF NOT EXISTS ultimo_retratamento_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_error_reports_retratamento
  ON public.error_reports (ultimo_retratamento_em DESC)
  WHERE eh_retratamento = true;
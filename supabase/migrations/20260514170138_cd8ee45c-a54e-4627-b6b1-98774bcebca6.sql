CREATE TABLE IF NOT EXISTS public.cobranca_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'executando',
  total_planejado integer NOT NULL DEFAULT 0,
  enviados integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  pulados integer NOT NULL DEFAULT 0,
  delay_ms integer NOT NULL DEFAULT 10000,
  criado_por uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT cobranca_runs_status_chk CHECK (status IN ('executando','concluido','falhou','cancelado'))
);

ALTER TABLE public.cobranca_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos leem cobranca_runs"
  ON public.cobranca_runs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_cobranca_runs_started_at
  ON public.cobranca_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_cobranca_eventos_nosso_numero
  ON public.cobranca_eventos ((dados->>'nosso_numero'))
  WHERE dados ? 'nosso_numero';
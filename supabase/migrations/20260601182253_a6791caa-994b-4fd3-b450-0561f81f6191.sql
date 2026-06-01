CREATE TABLE IF NOT EXISTS public.whatsapp_ia_pausas (
  telefone text PRIMARY KEY,
  pausada_ate timestamptz NOT NULL,
  motivo text NOT NULL,
  atendente_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_ia_pausas TO authenticated;
GRANT ALL ON public.whatsapp_ia_pausas TO service_role;

ALTER TABLE public.whatsapp_ia_pausas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos podem ler pausas IA"
  ON public.whatsapp_ia_pausas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Internos podem gravar pausas IA"
  ON public.whatsapp_ia_pausas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Internos podem atualizar pausas IA"
  ON public.whatsapp_ia_pausas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_whatsapp_ia_pausas_ate
  ON public.whatsapp_ia_pausas (pausada_ate);

CREATE TABLE public.sga_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  conexao_ok boolean NOT NULL,
  tempo_resposta_ms integer,
  fila_pendentes integer DEFAULT 0,
  fila_falhas integer DEFAULT 0,
  veiculos_nao_sincronizados integer DEFAULT 0,
  erro_mensagem text
);

ALTER TABLE public.sga_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view health checks"
  ON public.sga_health_checks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert health checks"
  ON public.sga_health_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

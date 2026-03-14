
-- Create generic health checks table
CREATE TABLE public.integracoes_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  integracao text NOT NULL,
  conexao_ok boolean NOT NULL DEFAULT false,
  tempo_resposta_ms integer,
  detalhes jsonb DEFAULT '{}'::jsonb,
  erro_mensagem text
);

-- Index for fast lookups by integration
CREATE INDEX idx_integracoes_health_checks_integracao ON public.integracoes_health_checks (integracao, created_at DESC);

-- RLS
ALTER TABLE public.integracoes_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read health checks"
  ON public.integracoes_health_checks FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can insert health checks"
  ON public.integracoes_health_checks FOR INSERT
  TO service_role WITH CHECK (true);

-- Migrate existing SGA data
INSERT INTO public.integracoes_health_checks (created_at, integracao, conexao_ok, tempo_resposta_ms, detalhes, erro_mensagem)
SELECT 
  created_at,
  'hinova',
  conexao_ok,
  tempo_resposta_ms,
  jsonb_build_object(
    'fila_pendentes', fila_pendentes,
    'fila_falhas', fila_falhas,
    'veiculos_nao_sincronizados', veiculos_nao_sincronizados
  ),
  erro_mensagem
FROM public.sga_health_checks;

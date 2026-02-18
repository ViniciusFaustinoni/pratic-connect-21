CREATE TABLE sinistro_analises_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id UUID NOT NULL REFERENCES sinistros(id) ON DELETE CASCADE,
  pontuacao_risco INTEGER NOT NULL,
  nivel TEXT NOT NULL,
  resumo TEXT NOT NULL,
  fatores JSONB NOT NULL DEFAULT '[]',
  recomendacao TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sinistro_analises_ia_sinistro ON sinistro_analises_ia(sinistro_id);

ALTER TABLE sinistro_analises_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read analises"
  ON sinistro_analises_ia FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can insert analises"
  ON sinistro_analises_ia FOR INSERT
  TO service_role WITH CHECK (true);
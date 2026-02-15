
CREATE TABLE public.cobranca_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID NOT NULL REFERENCES associados(id),
  tipo TEXT NOT NULL,
  subtipo TEXT,
  descricao TEXT NOT NULL,
  dados JSONB DEFAULT '{}',
  criado_por UUID REFERENCES profiles(id),
  automatico BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cobranca_eventos_associado ON public.cobranca_eventos(associado_id);
CREATE INDEX idx_cobranca_eventos_created ON public.cobranca_eventos(created_at DESC);

ALTER TABLE public.cobranca_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem ver eventos" ON public.cobranca_eventos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados podem criar eventos" ON public.cobranca_eventos
  FOR INSERT TO authenticated WITH CHECK (true);

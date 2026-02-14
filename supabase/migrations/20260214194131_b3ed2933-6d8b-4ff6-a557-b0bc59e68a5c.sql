
CREATE TABLE public.sindicancia_evidencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sinistro_id UUID NOT NULL REFERENCES public.sinistros(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'outro',
  titulo TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  registrado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sindicancia_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem ler evidencias"
  ON public.sindicancia_evidencias FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem inserir evidencias"
  ON public.sindicancia_evidencias FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem atualizar evidencias"
  ON public.sindicancia_evidencias FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem deletar evidencias"
  ON public.sindicancia_evidencias FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_sindicancia_evidencias_sinistro ON public.sindicancia_evidencias(sinistro_id);

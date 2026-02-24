
-- Tabela para fotos do reboquista
CREATE TABLE public.fotos_reboquista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id uuid NOT NULL REFERENCES public.chamados_assistencia(id) ON DELETE CASCADE,
  arquivo_url text NOT NULL,
  momento text CHECK (momento IN ('chegada', 'carregamento', 'entrega', 'outro')),
  observacao text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_fotos_reboquista_chamado ON public.fotos_reboquista(chamado_id);

-- RLS
ALTER TABLE public.fotos_reboquista ENABLE ROW LEVEL SECURITY;

-- SELECT: funcionários + sindicante via sinistro vinculado
CREATE POLICY "Funcionarios podem ver fotos reboquista"
  ON public.fotos_reboquista FOR SELECT
  USING (is_funcionario(auth.uid()));

CREATE POLICY "Sindicante pode ver fotos reboquista via sinistro"
  ON public.fotos_reboquista FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sinistros s
      WHERE (s.chamado_assistencia_id = fotos_reboquista.chamado_id OR s.chamado_origem_id = fotos_reboquista.chamado_id)
        AND is_sindicante_of_sinistro(s.id)
    )
  );

-- INSERT: analista_eventos ou diretor
CREATE POLICY "Analista e diretor podem inserir fotos reboquista"
  ON public.fotos_reboquista FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'analista_eventos') OR has_role(auth.uid(), 'diretor')
  );

-- DELETE: quem fez upload OU diretor
CREATE POLICY "Pode excluir foto reboquista"
  ON public.fotos_reboquista FOR DELETE
  USING (
    uploaded_by = auth.uid() OR has_role(auth.uid(), 'diretor')
  );

-- Bucket de storage público
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-reboquista', 'fotos-reboquista', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Leitura pública fotos reboquista"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fotos-reboquista');

CREATE POLICY "Upload fotos reboquista por analista/diretor"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'fotos-reboquista'
    AND (has_role(auth.uid(), 'analista_eventos') OR has_role(auth.uid(), 'diretor'))
  );

CREATE POLICY "Delete fotos reboquista por quem fez upload ou diretor"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'fotos-reboquista'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'diretor'))
  );

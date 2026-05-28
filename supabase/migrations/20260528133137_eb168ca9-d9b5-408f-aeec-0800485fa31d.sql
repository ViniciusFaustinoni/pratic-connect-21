
-- ===== Tabela tutoriais =====
CREATE TABLE public.tutoriais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  titulo text NOT NULL,
  descricao text NOT NULL,
  categoria text NOT NULL,
  tempo_estimado_min int NOT NULL DEFAULT 5,
  novo boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutoriais TO authenticated;
GRANT ALL ON public.tutoriais TO service_role;

ALTER TABLE public.tutoriais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutoriais viewable by authenticated"
ON public.tutoriais FOR SELECT TO authenticated USING (true);

CREATE POLICY "Tutoriais insert by diretor/admin"
ON public.tutoriais FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'admin_master'));

CREATE POLICY "Tutoriais update by diretor/admin"
ON public.tutoriais FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'admin_master'))
WITH CHECK (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'admin_master'));

CREATE POLICY "Tutoriais delete by diretor/admin"
ON public.tutoriais FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'admin_master'));

CREATE TRIGGER trg_tutoriais_updated_at
BEFORE UPDATE ON public.tutoriais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Tabela tutoriais_steps =====
CREATE TABLE public.tutoriais_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES public.tutoriais(id) ON DELETE CASCADE,
  numero int NOT NULL,
  titulo text NOT NULL,
  descricao text NOT NULL,
  imagem_url text,
  dicas jsonb NOT NULL DEFAULT '[]'::jsonb,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutorial_id, numero)
);

CREATE INDEX idx_tutoriais_steps_tutorial ON public.tutoriais_steps(tutorial_id, numero);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutoriais_steps TO authenticated;
GRANT ALL ON public.tutoriais_steps TO service_role;

ALTER TABLE public.tutoriais_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Steps viewable by authenticated"
ON public.tutoriais_steps FOR SELECT TO authenticated USING (true);

CREATE POLICY "Steps insert by diretor/admin"
ON public.tutoriais_steps FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'admin_master'));

CREATE POLICY "Steps update by diretor/admin"
ON public.tutoriais_steps FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'admin_master'))
WITH CHECK (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'admin_master'));

CREATE POLICY "Steps delete by diretor/admin"
ON public.tutoriais_steps FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'admin_master'));

-- ===== Bucket de Storage =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('tutoriais','tutoriais', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Tutoriais bucket public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tutoriais');

CREATE POLICY "Tutoriais bucket insert by diretor/admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tutoriais' AND (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'admin_master')));

CREATE POLICY "Tutoriais bucket update by diretor/admin"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tutoriais' AND (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'admin_master')))
WITH CHECK (bucket_id = 'tutoriais' AND (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'admin_master')));

CREATE POLICY "Tutoriais bucket delete by diretor/admin"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tutoriais' AND (public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'admin_master')));

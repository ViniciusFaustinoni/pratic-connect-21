-- Enum de status
DO $$ BEGIN
  CREATE TYPE public.error_report_status AS ENUM ('aberto', 'em_tratamento', 'concluido', 'validado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela principal
CREATE TABLE public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reporter_nome text,
  reporter_email text,
  area text NOT NULL,
  descricao text NOT NULL,
  status public.error_report_status NOT NULL DEFAULT 'aberto',
  observacao_diretor text,
  tratado_por uuid,
  tratado_em timestamptz,
  concluido_por uuid,
  concluido_em timestamptz,
  validado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_error_reports_reporter ON public.error_reports(reporter_id);
CREATE INDEX idx_error_reports_status ON public.error_reports(status);
CREATE INDEX idx_error_reports_created ON public.error_reports(created_at DESC);

-- Tabela de arquivos
CREATE TABLE public.error_report_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.error_reports(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome_original text,
  mime_type text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_error_report_files_report ON public.error_report_files(report_id);

-- updated_at trigger
CREATE TRIGGER trg_error_reports_updated_at
BEFORE UPDATE ON public.error_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_report_files ENABLE ROW LEVEL SECURITY;

-- Função helper: é diretor ou desenvolvedor?
CREATE OR REPLACE FUNCTION public.is_error_reports_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'diretor'::public.app_role)
      OR public.has_role(_user_id, 'desenvolvedor'::public.app_role)
      OR public.has_role(_user_id, 'admin_master'::public.app_role);
$$;

-- Policies error_reports
CREATE POLICY "select próprios ou admin"
ON public.error_reports FOR SELECT
USING (auth.uid() = reporter_id OR public.is_error_reports_admin(auth.uid()));

CREATE POLICY "insert próprio"
ON public.error_reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

-- Admin pode atualizar qualquer (status / observação)
CREATE POLICY "update admin"
ON public.error_reports FOR UPDATE
USING (public.is_error_reports_admin(auth.uid()))
WITH CHECK (public.is_error_reports_admin(auth.uid()));

-- Autor pode validar (concluido -> validado)
CREATE POLICY "update autor validar"
ON public.error_reports FOR UPDATE
USING (auth.uid() = reporter_id)
WITH CHECK (auth.uid() = reporter_id);

-- Policies error_report_files
CREATE POLICY "files select"
ON public.error_report_files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.error_reports r
    WHERE r.id = report_id
      AND (r.reporter_id = auth.uid() OR public.is_error_reports_admin(auth.uid()))
  )
);

CREATE POLICY "files insert"
ON public.error_report_files FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.error_reports r
    WHERE r.id = report_id AND r.reporter_id = auth.uid()
  )
);

CREATE POLICY "files delete admin"
ON public.error_report_files FOR DELETE
USING (public.is_error_reports_admin(auth.uid()));

-- Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('relatos-erros', 'relatos-erros', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "relatos-erros upload próprio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'relatos-erros'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "relatos-erros select dono ou admin"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'relatos-erros'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_error_reports_admin(auth.uid())
  )
);

CREATE POLICY "relatos-erros delete admin"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'relatos-erros'
  AND public.is_error_reports_admin(auth.uid())
);

-- 1) Enriquecer ocr_execution_logs
ALTER TABLE public.ocr_execution_logs
  ADD COLUMN IF NOT EXISTS dados_esperados jsonb,
  ADD COLUMN IF NOT EXISTS score_campos jsonb;

-- 2) Função de normalização e cálculo de score
CREATE OR REPLACE FUNCTION public.normalize_ocr_value(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(coalesce(v, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.calcular_score_ocr(esperado jsonb, obtido jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  k text;
  ve text;
  vo text;
  total int := 0;
  hits int := 0;
  comparacao jsonb := '{}'::jsonb;
  match_bool boolean;
BEGIN
  IF esperado IS NULL OR jsonb_typeof(esperado) <> 'object' THEN
    RETURN jsonb_build_object('score', NULL, 'comparacao', '{}'::jsonb, 'total', 0, 'hits', 0);
  END IF;

  FOR k IN SELECT jsonb_object_keys(esperado) LOOP
    ve := COALESCE(esperado ->> k, '');
    IF ve = '' THEN CONTINUE; END IF;
    vo := COALESCE(obtido ->> k, '');
    match_bool := public.normalize_ocr_value(ve) = public.normalize_ocr_value(vo) AND public.normalize_ocr_value(ve) <> '';
    total := total + 1;
    IF match_bool THEN hits := hits + 1; END IF;
    comparacao := comparacao || jsonb_build_object(k, jsonb_build_object('esperado', ve, 'obtido', vo, 'match', match_bool));
  END LOOP;

  RETURN jsonb_build_object(
    'score', CASE WHEN total > 0 THEN round((hits::numeric / total) * 100, 2) ELSE NULL END,
    'comparacao', comparacao,
    'total', total,
    'hits', hits
  );
END;
$$;

-- 3) Tabela de casos de teste
CREATE TABLE IF NOT EXISTS public.ocr_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  nome text NOT NULL,
  tipo_esperado text NOT NULL,
  arquivo_path text NOT NULL,
  arquivo_url text NOT NULL,
  mime text,
  bytes integer,
  expectativas jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_ocr_test_cases_tipo ON public.ocr_test_cases(tipo_esperado);
CREATE INDEX IF NOT EXISTS idx_ocr_test_cases_ativo ON public.ocr_test_cases(ativo);

ALTER TABLE public.ocr_test_cases ENABLE ROW LEVEL SECURITY;

-- 4) Tabela de execuções de teste
CREATE TABLE IF NOT EXISTS public.ocr_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_by uuid,
  test_case_id uuid REFERENCES public.ocr_test_cases(id) ON DELETE SET NULL,
  ocr_log_id uuid REFERENCES public.ocr_execution_logs(id) ON DELETE SET NULL,
  provider text,
  modelo text,
  prompt_version text,
  latency_ms integer,
  dados_extraidos jsonb,
  dados_esperados jsonb,
  comparacao jsonb,
  score_geral numeric,
  veredito text CHECK (veredito IN ('aprovado','parcial','reprovado','pendente')),
  anotacao_humana text
);

CREATE INDEX IF NOT EXISTS idx_ocr_test_runs_case ON public.ocr_test_runs(test_case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_test_runs_created ON public.ocr_test_runs(created_at DESC);

ALTER TABLE public.ocr_test_runs ENABLE ROW LEVEL SECURITY;

-- 5) Trigger de updated_at em test_cases
CREATE OR REPLACE FUNCTION public.update_ocr_test_cases_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ocr_test_cases_updated_at ON public.ocr_test_cases;
CREATE TRIGGER trg_ocr_test_cases_updated_at
  BEFORE UPDATE ON public.ocr_test_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_ocr_test_cases_updated_at();

-- 6) RLS policies — usar has_role existente
DROP POLICY IF EXISTS "OCR tests read" ON public.ocr_test_cases;
CREATE POLICY "OCR tests read"
ON public.ocr_test_cases FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'diretor'::app_role) OR
  public.has_role(auth.uid(), 'admin_master'::app_role) OR
  public.has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  public.has_role(auth.uid(), 'desenvolvedor'::app_role)
);

DROP POLICY IF EXISTS "OCR tests write" ON public.ocr_test_cases;
CREATE POLICY "OCR tests write"
ON public.ocr_test_cases FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'diretor'::app_role) OR
  public.has_role(auth.uid(), 'admin_master'::app_role) OR
  public.has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  public.has_role(auth.uid(), 'desenvolvedor'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'diretor'::app_role) OR
  public.has_role(auth.uid(), 'admin_master'::app_role) OR
  public.has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  public.has_role(auth.uid(), 'desenvolvedor'::app_role)
);

DROP POLICY IF EXISTS "OCR test runs read" ON public.ocr_test_runs;
CREATE POLICY "OCR test runs read"
ON public.ocr_test_runs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'diretor'::app_role) OR
  public.has_role(auth.uid(), 'admin_master'::app_role) OR
  public.has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  public.has_role(auth.uid(), 'desenvolvedor'::app_role)
);

DROP POLICY IF EXISTS "OCR test runs write" ON public.ocr_test_runs;
CREATE POLICY "OCR test runs write"
ON public.ocr_test_runs FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'diretor'::app_role) OR
  public.has_role(auth.uid(), 'admin_master'::app_role) OR
  public.has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  public.has_role(auth.uid(), 'desenvolvedor'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'diretor'::app_role) OR
  public.has_role(auth.uid(), 'admin_master'::app_role) OR
  public.has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  public.has_role(auth.uid(), 'desenvolvedor'::app_role)
);

-- 7) Storage policies para subpasta ocr-tests/ no bucket cotacoes-docs
DROP POLICY IF EXISTS "OCR tests upload" ON storage.objects;
CREATE POLICY "OCR tests upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cotacoes-docs'
  AND (storage.foldername(name))[1] = 'ocr-tests'
  AND (
    public.has_role(auth.uid(), 'diretor'::app_role) OR
    public.has_role(auth.uid(), 'admin_master'::app_role) OR
    public.has_role(auth.uid(), 'analista_cadastro'::app_role) OR
    public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  )
);

DROP POLICY IF EXISTS "OCR tests delete" ON storage.objects;
CREATE POLICY "OCR tests delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'cotacoes-docs'
  AND (storage.foldername(name))[1] = 'ocr-tests'
  AND (
    public.has_role(auth.uid(), 'diretor'::app_role) OR
    public.has_role(auth.uid(), 'admin_master'::app_role) OR
    public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  )
);

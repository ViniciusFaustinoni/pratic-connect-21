-- =========================================================
-- FASE 1: Modelo de dados de Comissões por parcela + vitalícia
-- =========================================================

CREATE TABLE IF NOT EXISTS public.grades_comissao_parcelas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grade_id UUID NOT NULL REFERENCES public.grades_comissao(id) ON DELETE CASCADE,
  numero_parcela INTEGER,
  vitalicia BOOLEAN NOT NULL DEFAULT false,
  vitalicia_inicio_parcela INTEGER,
  label TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_grade_parcela_numero
  ON public.grades_comissao_parcelas(grade_id, numero_parcela)
  WHERE vitalicia = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_grade_parcela_vitalicia
  ON public.grades_comissao_parcelas(grade_id)
  WHERE vitalicia = true;

ALTER TABLE public.grades_comissao_parcelas
  ADD CONSTRAINT chk_parcela_numero_ou_vitalicia
  CHECK (
    (vitalicia = true AND vitalicia_inicio_parcela IS NOT NULL AND vitalicia_inicio_parcela >= 1)
    OR
    (vitalicia = false AND numero_parcela IS NOT NULL AND numero_parcela >= 1)
  );

CREATE INDEX IF NOT EXISTS idx_grades_comissao_parcelas_grade
  ON public.grades_comissao_parcelas(grade_id);

CREATE TABLE IF NOT EXISTS public.grades_comissao_versoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grade_id UUID NOT NULL REFERENCES public.grades_comissao(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_grade_versao
  ON public.grades_comissao_versoes(grade_id, versao);

CREATE INDEX IF NOT EXISTS idx_grades_comissao_versoes_grade
  ON public.grades_comissao_versoes(grade_id);

ALTER TABLE public.grades_comissao
  ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.grades_comissao_niveis
  ADD COLUMN IF NOT EXISTS parcela_id UUID REFERENCES public.grades_comissao_parcelas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_grades_comissao_niveis_parcela
  ON public.grades_comissao_niveis(parcela_id);

ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS grade_versao_id UUID REFERENCES public.grades_comissao_versoes(id);

CREATE INDEX IF NOT EXISTS idx_comissoes_grade_versao
  ON public.comissoes(grade_versao_id);

-- Migração de dados: criar parcela "Taxa de Adesão" para grades existentes
DO $$
DECLARE
  g RECORD;
  v_parcela_id UUID;
BEGIN
  FOR g IN SELECT id FROM public.grades_comissao LOOP
    SELECT id INTO v_parcela_id
    FROM public.grades_comissao_parcelas
    WHERE grade_id = g.id AND vitalicia = false AND numero_parcela = 1
    LIMIT 1;

    IF v_parcela_id IS NULL THEN
      INSERT INTO public.grades_comissao_parcelas (grade_id, numero_parcela, vitalicia, label, ordem)
      VALUES (g.id, 1, false, 'Taxa de Adesão', 0)
      RETURNING id INTO v_parcela_id;
    END IF;

    UPDATE public.grades_comissao_niveis
    SET parcela_id = v_parcela_id
    WHERE grade_id = g.id AND parcela_id IS NULL;
  END LOOP;
END $$;

-- Snapshot inicial v1 para cada grade existente
DO $$
DECLARE
  g RECORD;
  v_snap JSONB;
BEGIN
  FOR g IN SELECT * FROM public.grades_comissao LOOP
    SELECT jsonb_build_object(
      'grade', to_jsonb(g),
      'parcelas', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'parcela', to_jsonb(p),
            'niveis', COALESCE((
              SELECT jsonb_agg(to_jsonb(n))
              FROM public.grades_comissao_niveis n
              WHERE n.parcela_id = p.id
            ), '[]'::jsonb)
          ) ORDER BY p.ordem
        )
        FROM public.grades_comissao_parcelas p
        WHERE p.grade_id = g.id
      ), '[]'::jsonb)
    ) INTO v_snap;

    INSERT INTO public.grades_comissao_versoes (grade_id, versao, snapshot, vigente_desde)
    VALUES (g.id, 1, v_snap, COALESCE(g.created_at, now()))
    ON CONFLICT (grade_id, versao) DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_grades_comissao_parcelas_updated_at ON public.grades_comissao_parcelas;
CREATE TRIGGER trg_grades_comissao_parcelas_updated_at
BEFORE UPDATE ON public.grades_comissao_parcelas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.grades_comissao_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades_comissao_versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_parcelas_gestao" ON public.grades_comissao_parcelas;
CREATE POLICY "view_parcelas_gestao"
ON public.grades_comissao_parcelas
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'gerente_comercial'::app_role)
  OR public.has_role(auth.uid(), 'supervisor_vendas'::app_role)
);

DROP POLICY IF EXISTS "manage_parcelas_diretor" ON public.grades_comissao_parcelas;
CREATE POLICY "manage_parcelas_diretor"
ON public.grades_comissao_parcelas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'diretor'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'diretor'::app_role));

DROP POLICY IF EXISTS "view_versoes_gestao" ON public.grades_comissao_versoes;
CREATE POLICY "view_versoes_gestao"
ON public.grades_comissao_versoes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'gerente_comercial'::app_role)
  OR public.has_role(auth.uid(), 'supervisor_vendas'::app_role)
);

DROP POLICY IF EXISTS "manage_versoes_diretor" ON public.grades_comissao_versoes;
CREATE POLICY "manage_versoes_diretor"
ON public.grades_comissao_versoes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'diretor'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'diretor'::app_role));
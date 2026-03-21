-- Tabela principal de grades de comissão
CREATE TABLE public.grades_comissao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Níveis de cada grade
CREATE TABLE public.grades_comissao_niveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id UUID NOT NULL REFERENCES public.grades_comissao(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  percentual NUMERIC NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER set_grades_comissao_updated_at
  BEFORE UPDATE ON public.grades_comissao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX idx_grades_comissao_niveis_grade ON public.grades_comissao_niveis(grade_id);
CREATE INDEX idx_grades_comissao_ativo ON public.grades_comissao(ativo);

-- RLS
ALTER TABLE public.grades_comissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades_comissao_niveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grades_comissao_select" ON public.grades_comissao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "grades_comissao_niveis_select" ON public.grades_comissao_niveis
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "grades_comissao_insert" ON public.grades_comissao
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'admin_master')
  );

CREATE POLICY "grades_comissao_update" ON public.grades_comissao
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'admin_master')
  );

CREATE POLICY "grades_comissao_delete" ON public.grades_comissao
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'admin_master')
  );

CREATE POLICY "grades_comissao_niveis_insert" ON public.grades_comissao_niveis
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'admin_master')
  );

CREATE POLICY "grades_comissao_niveis_update" ON public.grades_comissao_niveis
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'admin_master')
  );

CREATE POLICY "grades_comissao_niveis_delete" ON public.grades_comissao_niveis
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'admin_master')
  );
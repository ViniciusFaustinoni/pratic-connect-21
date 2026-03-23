-- Tabela de vínculo entre usuários e grades de comissão
CREATE TABLE public.usuario_grade_comissao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grade_id UUID NOT NULL REFERENCES public.grades_comissao(id) ON DELETE RESTRICT,
  atribuido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.usuario_grade_comissao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar vinculos de grade"
ON public.usuario_grade_comissao FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'manage_users'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

CREATE POLICY "Usuario ve propria grade"
ON public.usuario_grade_comissao FOR SELECT TO authenticated
USING (user_id = auth.uid());
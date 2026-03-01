
-- Tabelas de visibilidade por usuário

CREATE TABLE public.user_module_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  visible boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

CREATE TABLE public.user_module_item_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  item_id text NOT NULL,
  visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id, item_id)
);

-- RLS
ALTER TABLE public.user_module_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_item_visibility ENABLE ROW LEVEL SECURITY;

-- Políticas: qualquer autenticado pode ler (necessário para o próprio usuário ver seus módulos)
CREATE POLICY "Authenticated users can read own visibility"
  ON public.user_module_visibility FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can read own item visibility"
  ON public.user_module_item_visibility FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Diretores/Devs podem ler todos
CREATE POLICY "Directors can read all user visibility"
  ON public.user_module_visibility FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "Directors can read all user item visibility"
  ON public.user_module_item_visibility FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'desenvolvedor'));

-- Diretores/Devs podem inserir/atualizar/deletar
CREATE POLICY "Directors can manage user visibility"
  ON public.user_module_visibility FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "Directors can manage user item visibility"
  ON public.user_module_item_visibility FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'desenvolvedor'));

-- Índices
CREATE INDEX idx_user_module_visibility_user_id ON public.user_module_visibility(user_id);
CREATE INDEX idx_user_module_item_visibility_user_id ON public.user_module_item_visibility(user_id);


-- Tabela de vínculo agência → vendedores
CREATE TABLE public.agencia_vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendedor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agencia_user_id, vendedor_user_id)
);

ALTER TABLE public.agencia_vendedores ENABLE ROW LEVEL SECURITY;

-- Admins gerenciam vínculos
CREATE POLICY "Admins gerenciam agencia_vendedores"
ON public.agencia_vendedores FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'manage_users'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

-- Agência vê seus próprios vínculos
CREATE POLICY "Agencia ve seus vendedores"
ON public.agencia_vendedores FOR SELECT TO authenticated
USING (agencia_user_id = auth.uid());

-- Atualizar app_roles_config para agencia
UPDATE public.app_roles_config SET
  is_operational = true,
  redirect_path = '/agencia',
  permissions = '["canViewContaCorrente","canViewComissoesEquipe"]'::jsonb
WHERE role = 'agencia';

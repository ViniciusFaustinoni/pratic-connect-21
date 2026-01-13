-- Criar função para verificar se é diretor ou admin_master
CREATE OR REPLACE FUNCTION public.is_diretor_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
      AND role IN ('diretor', 'admin_master')
  )
$$;

-- Atualizar política de DELETE para incluir admin_master
DROP POLICY IF EXISTS "Only directors can delete contracts" ON contratos;
CREATE POLICY "Directors and admins can delete contracts" ON contratos
  FOR DELETE TO authenticated
  USING (is_diretor_or_admin(auth.uid()));
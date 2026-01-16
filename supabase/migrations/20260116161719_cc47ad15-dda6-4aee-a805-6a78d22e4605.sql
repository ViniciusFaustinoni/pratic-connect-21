-- Atualizar função is_diretor_for_crud para incluir 'admin'
CREATE OR REPLACE FUNCTION is_diretor_for_crud(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('admin', 'diretor', 'desenvolvedor', 'admin_master')
  )
$$;
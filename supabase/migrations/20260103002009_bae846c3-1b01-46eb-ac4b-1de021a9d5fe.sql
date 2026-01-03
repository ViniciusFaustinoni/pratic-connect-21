-- Funções helper adicionais para SGA PRATIC 2.0

-- Retorna array de perfis/roles do usuário
CREATE OR REPLACE FUNCTION public.get_user_perfis(_user_id uuid)
RETURNS app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(role), ARRAY[]::app_role[])
  FROM public.user_roles 
  WHERE user_id = _user_id
$$;

-- Versão sem parâmetro (usa auth.uid())
CREATE OR REPLACE FUNCTION public.get_my_perfis()
RETURNS app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(role), ARRAY[]::app_role[])
  FROM public.user_roles 
  WHERE user_id = auth.uid()
$$;

-- Retorna ID do profile do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;
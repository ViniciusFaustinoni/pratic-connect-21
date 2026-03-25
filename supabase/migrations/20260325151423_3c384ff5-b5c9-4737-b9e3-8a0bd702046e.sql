-- Function to check if user has canCreateUser permission
CREATE OR REPLACE FUNCTION public.can_manage_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.app_roles_config arc ON arc.role = ur.role::text
    WHERE ur.user_id = _user_id
      AND arc.is_active = true
      AND arc.permissions::jsonb @> '["canCreateUser"]'::jsonb
  )
$$;

-- Profiles: SELECT for team managers
CREATE POLICY "Team managers can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.can_manage_users(auth.uid()));

-- Profiles: UPDATE for team managers
CREATE POLICY "Team managers can update profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.can_manage_users(auth.uid()))
WITH CHECK (public.can_manage_users(auth.uid()));

-- User roles: ALL for team managers
CREATE POLICY "Team managers can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.can_manage_users(auth.uid()))
WITH CHECK (public.can_manage_users(auth.uid()));
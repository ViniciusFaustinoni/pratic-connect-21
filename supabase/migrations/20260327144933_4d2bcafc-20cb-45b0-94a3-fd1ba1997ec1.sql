-- Consolidate RLS policies on user_module_visibility

DROP POLICY IF EXISTS "Directors can insert user visibility" ON public.user_module_visibility;
DROP POLICY IF EXISTS "Team managers can insert user visibility" ON public.user_module_visibility;

CREATE POLICY "Managers can insert user visibility"
  ON public.user_module_visibility FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'diretor'::app_role) 
    OR has_role(auth.uid(), 'desenvolvedor'::app_role) 
    OR can_manage_users(auth.uid())
  );

DROP POLICY IF EXISTS "Directors can update user visibility" ON public.user_module_visibility;
DROP POLICY IF EXISTS "Team managers can update user visibility" ON public.user_module_visibility;

CREATE POLICY "Managers can update user visibility"
  ON public.user_module_visibility FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role) OR can_manage_users(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role) OR can_manage_users(auth.uid()));

DROP POLICY IF EXISTS "Directors can delete user visibility" ON public.user_module_visibility;
DROP POLICY IF EXISTS "Team managers can delete user visibility" ON public.user_module_visibility;

CREATE POLICY "Managers can delete user visibility"
  ON public.user_module_visibility FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role) OR can_manage_users(auth.uid()));

-- Same for user_module_item_visibility
DROP POLICY IF EXISTS "Directors can insert item visibility" ON public.user_module_item_visibility;
DROP POLICY IF EXISTS "Team managers can insert item visibility" ON public.user_module_item_visibility;

CREATE POLICY "Managers can insert item visibility"
  ON public.user_module_item_visibility FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'diretor'::app_role) 
    OR has_role(auth.uid(), 'desenvolvedor'::app_role) 
    OR can_manage_users(auth.uid())
  );

DROP POLICY IF EXISTS "Directors can update item visibility" ON public.user_module_item_visibility;
DROP POLICY IF EXISTS "Team managers can update item visibility" ON public.user_module_item_visibility;

CREATE POLICY "Managers can update item visibility"
  ON public.user_module_item_visibility FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role) OR can_manage_users(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role) OR can_manage_users(auth.uid()));

DROP POLICY IF EXISTS "Directors can delete item visibility" ON public.user_module_item_visibility;
DROP POLICY IF EXISTS "Team managers can delete item visibility" ON public.user_module_item_visibility;

CREATE POLICY "Managers can delete item visibility"
  ON public.user_module_item_visibility FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role) OR can_manage_users(auth.uid()));
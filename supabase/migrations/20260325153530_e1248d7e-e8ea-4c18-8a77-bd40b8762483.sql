-- 1. Add missing enum value
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'analista_monitoramento';

-- 2. RLS policy for user_module_visibility
CREATE POLICY "Team managers can manage user visibility"
  ON public.user_module_visibility FOR ALL TO authenticated
  USING (public.can_manage_users(auth.uid()))
  WITH CHECK (public.can_manage_users(auth.uid()));

-- 3. RLS policy for user_module_item_visibility
CREATE POLICY "Team managers can manage user item visibility"
  ON public.user_module_item_visibility FOR ALL TO authenticated
  USING (public.can_manage_users(auth.uid()))
  WITH CHECK (public.can_manage_users(auth.uid()));
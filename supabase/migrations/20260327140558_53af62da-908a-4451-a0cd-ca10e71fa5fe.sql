-- Fix RLS for user_module_visibility: replace FOR ALL with explicit policies

DROP POLICY IF EXISTS "Directors can manage user visibility" ON user_module_visibility;
DROP POLICY IF EXISTS "Team managers can manage user visibility" ON user_module_visibility;

CREATE POLICY "Directors can insert user visibility" ON user_module_visibility
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Directors can update user visibility" ON user_module_visibility
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role))
WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Directors can delete user visibility" ON user_module_visibility
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Team managers can insert user visibility" ON user_module_visibility
FOR INSERT TO authenticated
WITH CHECK (can_manage_users(auth.uid()));

CREATE POLICY "Team managers can update user visibility" ON user_module_visibility
FOR UPDATE TO authenticated
USING (can_manage_users(auth.uid()))
WITH CHECK (can_manage_users(auth.uid()));

CREATE POLICY "Team managers can delete user visibility" ON user_module_visibility
FOR DELETE TO authenticated
USING (can_manage_users(auth.uid()));

-- Fix RLS for user_module_item_visibility

DROP POLICY IF EXISTS "Directors can manage item visibility" ON user_module_item_visibility;
DROP POLICY IF EXISTS "Team managers can manage item visibility" ON user_module_item_visibility;

CREATE POLICY "Directors can insert item visibility" ON user_module_item_visibility
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Directors can update item visibility" ON user_module_item_visibility
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role))
WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Directors can delete item visibility" ON user_module_item_visibility
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Team managers can insert item visibility" ON user_module_item_visibility
FOR INSERT TO authenticated
WITH CHECK (can_manage_users(auth.uid()));

CREATE POLICY "Team managers can update item visibility" ON user_module_item_visibility
FOR UPDATE TO authenticated
USING (can_manage_users(auth.uid()))
WITH CHECK (can_manage_users(auth.uid()));

CREATE POLICY "Team managers can delete item visibility" ON user_module_item_visibility
FOR DELETE TO authenticated
USING (can_manage_users(auth.uid()));
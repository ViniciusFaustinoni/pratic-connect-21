

# Fix RLS Error on "Salvar acessos" for `user_module_visibility`

## Problem

When saving module access configuration, the upsert to `user_module_visibility` fails with "new row violates row-level security policy". The existing RLS policies use `FOR ALL` which can behave unexpectedly with upserts.

## Root Cause

The `FOR ALL` policies combine USING + WITH CHECK in ways that can conflict during upsert (INSERT...ON CONFLICT UPDATE). The safer approach is explicit INSERT and UPDATE policies.

## Fix — Migration to recreate RLS policies

Drop existing management policies and replace with explicit INSERT, UPDATE, and DELETE policies:

```sql
-- Drop the two ALL policies
DROP POLICY "Directors can manage user visibility" ON user_module_visibility;
DROP POLICY "Team managers can manage user visibility" ON user_module_visibility;

-- Explicit INSERT
CREATE POLICY "Directors can insert user visibility" ON user_module_visibility
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

-- Explicit UPDATE
CREATE POLICY "Directors can update user visibility" ON user_module_visibility
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role))
WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

-- Explicit DELETE
CREATE POLICY "Directors can delete user visibility" ON user_module_visibility
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'desenvolvedor'::app_role));

-- Same for team managers
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
```

Apply the same pattern for `user_module_item_visibility` table.

## Files changed

| File | Action |
|---|---|
| New migration | Replace ALL policies with explicit INSERT/UPDATE/DELETE on both visibility tables |




# Fix RLS Error on "Acesso a Módulos" Save

## Problem

When saving module access configuration (`user_module_visibility`), the system throws: **"new row violates row-level security policy for table user_module_visibility"**.

## Root Cause

The admin user (`admin@teste.com`, id `37beadcf-...`) has **no entry in `user_roles`**. The RLS INSERT/UPDATE policies on `user_module_visibility` require either:
- `has_role(auth.uid(), 'diretor')` or `has_role(auth.uid(), 'desenvolvedor')`, OR
- `can_manage_users(auth.uid())` — which checks for `canCreateUser` permission in `app_roles_config`

Since the user has no role at all, both checks fail.

## Fix

The RLS policies themselves are correct in logic — the issue is that `can_manage_users` already covers the dynamic permission check. We need to also use `has_permission` for a more granular capability. But the simplest and most correct fix is to **also allow users with the `canManageModuleAccess` or similar permission**.

However, looking at the existing architecture, the real fix is two-fold:

### 1. Migration — Broaden RLS to use `has_permission` function

Update the INSERT, UPDATE, and DELETE policies on `user_module_visibility` to also check `has_permission(auth.uid(), 'canManageModuleAccess')` as an alternative path, so any role with that capability can manage module visibility.

If `has_permission` doesn't exist yet or `canManageModuleAccess` isn't a defined capability, we fall back to using the existing `can_manage_users` function which checks `canCreateUser` — and ensure the admin role has that permission.

### 2. Data fix — Ensure admin@teste.com has a role

Insert the `diretor` role for the admin user (`37beadcf-284b-4a2c-88a0-6efa8cae60d9`) into `user_roles` so the test account works. This is a data issue but should be addressed.

## Proposed SQL Migration

```sql
-- Ensure admin test user has diretor role
INSERT INTO public.user_roles (user_id, role)
VALUES ('37beadcf-284b-4a2c-88a0-6efa8cae60d9', 'diretor')
ON CONFLICT (user_id, role) DO NOTHING;
```

And update the RLS policies to be more permissive for users with management capabilities:

```sql
-- Drop and recreate INSERT policy
DROP POLICY IF EXISTS "Directors can insert user visibility" ON public.user_module_visibility;
DROP POLICY IF EXISTS "Team managers can insert user visibility" ON public.user_module_visibility;

CREATE POLICY "Managers can insert user visibility"
  ON public.user_module_visibility FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'diretor'::app_role) 
    OR has_role(auth.uid(), 'desenvolvedor'::app_role) 
    OR can_manage_users(auth.uid())
  );

-- Same for UPDATE and DELETE (consolidate duplicate policies)
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
```

## Files

| File | Action |
|---|---|
| New SQL migration | Insert diretor role for admin user + consolidate RLS policies |

No frontend code changes needed — the issue is purely RLS + missing role data.


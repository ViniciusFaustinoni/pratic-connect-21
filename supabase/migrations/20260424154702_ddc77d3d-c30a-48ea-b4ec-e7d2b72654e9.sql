
-- =========================================================
-- Reforça RLS da tabela cotacoes para impedir vazamento
-- entre consultores. Visão ampla apenas para gestores,
-- diretoria, supervisor de vendas, analista de cadastro
-- e super admin/desenvolvedor. Vendedores veem somente
-- as próprias cotações.
-- =========================================================

-- Função auxiliar: pode ver todas as cotações?
CREATE OR REPLACE FUNCTION public.can_view_all_cotacoes(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND p.ativo = true
      AND (p.bloqueado IS NULL OR p.bloqueado = false)
      AND ur.role::text IN (
        'diretor',
        'gerente_comercial',
        'supervisor_vendas',
        'analista_cadastro',
        'admin_master',
        'desenvolvedor'
      )
  )
$$;

-- Função auxiliar: pode gerenciar (update/delete) cotações além das próprias?
CREATE OR REPLACE FUNCTION public.can_manage_all_cotacoes(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND p.ativo = true
      AND (p.bloqueado IS NULL OR p.bloqueado = false)
      AND ur.role::text IN (
        'diretor',
        'gerente_comercial',
        'supervisor_vendas',
        'admin_master',
        'desenvolvedor'
      )
  )
$$;

-- Remover policies antigas que vazavam acesso
DROP POLICY IF EXISTS "Sales can view own quotes" ON public.cotacoes;
DROP POLICY IF EXISTS "Sales can update own quotes" ON public.cotacoes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON public.cotacoes;

-- SELECT: vendedor vê só as suas; perfis autorizados veem todas
CREATE POLICY "Cotacoes select scoped"
ON public.cotacoes
FOR SELECT
TO authenticated
USING (
  vendedor_id = auth.uid()
  OR public.can_view_all_cotacoes(auth.uid())
);

-- UPDATE: vendedor altera só as suas; gestores podem todas
CREATE POLICY "Cotacoes update scoped"
ON public.cotacoes
FOR UPDATE
TO authenticated
USING (
  vendedor_id = auth.uid()
  OR public.can_manage_all_cotacoes(auth.uid())
)
WITH CHECK (
  vendedor_id = auth.uid()
  OR public.can_manage_all_cotacoes(auth.uid())
);

-- DELETE: vendedor exclui só as suas; gestores podem todas
CREATE POLICY "Cotacoes delete scoped"
ON public.cotacoes
FOR DELETE
TO authenticated
USING (
  vendedor_id = auth.uid()
  OR public.can_manage_all_cotacoes(auth.uid())
);

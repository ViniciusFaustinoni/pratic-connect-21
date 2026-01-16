-- 1. Criar função de permissão para criação de contratos
CREATE OR REPLACE FUNCTION public.can_create_contracts(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.profiles p ON ur.user_id = p.user_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('diretor', 'gerente_comercial', 'supervisor_vendas', 'vendedor_clt', 'vendedor_externo')
      AND p.ativo = true
      AND (p.bloqueado IS NULL OR p.bloqueado = false)
  )
$$;

-- 2. Remover política restritiva atual
DROP POLICY IF EXISTS "Management can insert contracts" ON contratos;

-- 3. Nova política: Vendedores e Gerência podem inserir contratos
CREATE POLICY "Staff with sales role can insert contracts" ON contratos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_create_contracts(auth.uid()));
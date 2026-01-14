-- 1) Corrigir a trigger auto_atribuir_lead_vendedor para usar get_my_profile_id() ao invés de auth.uid()
CREATE OR REPLACE FUNCTION public.auto_atribuir_lead_vendedor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Se vendedor_id já está preenchido, não faz nada
  IF NEW.vendedor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Obtém o profile_id do usuário logado
  v_profile_id := public.get_my_profile_id();
  
  -- Se o usuário logado é vendedor e não é gerência, atribui automaticamente
  IF v_profile_id IS NOT NULL 
     AND public.is_vendedor(auth.uid()) 
     AND NOT public.is_gerencia(auth.uid()) THEN
    NEW.vendedor_id := v_profile_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Atualizar políticas RLS da tabela leads para usar get_my_profile_id()

-- Primeiro, remover as políticas existentes que usam auth.uid() incorretamente
DROP POLICY IF EXISTS "Vendedores podem ver seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Vendedores podem criar leads" ON public.leads;
DROP POLICY IF EXISTS "Vendedores podem atualizar seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Vendedores podem deletar seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_update_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON public.leads;

-- Recriar políticas usando get_my_profile_id()

-- SELECT: Gerência vê todos, vendedores veem seus próprios leads
CREATE POLICY "leads_select_policy" ON public.leads
FOR SELECT TO authenticated
USING (
  public.is_gerencia(auth.uid()) 
  OR vendedor_id = public.get_my_profile_id()
  OR vendedor_id IS NULL
);

-- INSERT: Qualquer usuário autenticado pode criar leads
CREATE POLICY "leads_insert_policy" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (true);

-- UPDATE: Gerência pode atualizar qualquer lead, vendedores seus próprios
CREATE POLICY "leads_update_policy" ON public.leads
FOR UPDATE TO authenticated
USING (
  public.is_gerencia(auth.uid()) 
  OR vendedor_id = public.get_my_profile_id()
)
WITH CHECK (
  public.is_gerencia(auth.uid()) 
  OR vendedor_id = public.get_my_profile_id()
);

-- DELETE: Gerência pode deletar qualquer lead, vendedores seus próprios
CREATE POLICY "leads_delete_policy" ON public.leads
FOR DELETE TO authenticated
USING (
  public.is_gerencia(auth.uid()) 
  OR vendedor_id = public.get_my_profile_id()
);
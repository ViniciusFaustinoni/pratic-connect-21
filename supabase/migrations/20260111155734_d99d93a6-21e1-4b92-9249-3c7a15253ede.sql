-- ============================================
-- CORRIGIR RLS: leads agora usa vendedor_id = auth.uid()
-- (antes usava get_current_profile_id() que retorna profiles.id)
-- ============================================

-- 1. Dropar policies existentes de SELECT/UPDATE/DELETE
DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_update_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON public.leads;
DROP POLICY IF EXISTS "Sales can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Sales can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Sales can delete own leads" ON public.leads;

-- 2. Criar policies com auth.uid() (vendedor_id agora é user_id, não profile.id)

-- SELECT: vendedor vê seus leads + não atribuídos + gerência/supervisor vê tudo
CREATE POLICY "leads_select_policy" ON public.leads
FOR SELECT TO authenticated
USING (
  (vendedor_id = auth.uid())
  OR (vendedor_id IS NULL AND is_vendedor(auth.uid()))
  OR has_role(auth.uid(), 'supervisor_vendas')
  OR is_gerencia(auth.uid())
);

-- UPDATE: vendedor edita seus leads + gerência/supervisor edita tudo
CREATE POLICY "leads_update_policy" ON public.leads
FOR UPDATE TO authenticated
USING (
  (vendedor_id = auth.uid())
  OR has_role(auth.uid(), 'supervisor_vendas')
  OR is_gerencia(auth.uid())
);

-- DELETE: vendedor exclui seus leads + gerência exclui qualquer
CREATE POLICY "leads_delete_policy" ON public.leads
FOR DELETE TO authenticated
USING (
  (vendedor_id = auth.uid())
  OR is_gerencia(auth.uid())
);

-- ============================================
-- TRIGGER: Auto-atribuir lead ao vendedor que criou (se não for gerência)
-- ============================================

-- Função para auto-atribuição
CREATE OR REPLACE FUNCTION public.auto_atribuir_lead_vendedor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se vendedor_id não foi definido E o criador é vendedor (mas não gerência),
  -- atribui automaticamente ao criador
  IF NEW.vendedor_id IS NULL 
     AND is_vendedor(auth.uid()) 
     AND NOT is_gerencia(auth.uid()) THEN
    NEW.vendedor_id := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Dropar trigger existente se houver
DROP TRIGGER IF EXISTS trigger_auto_atribuir_lead ON public.leads;

-- Criar trigger BEFORE INSERT
CREATE TRIGGER trigger_auto_atribuir_lead
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_atribuir_lead_vendedor();
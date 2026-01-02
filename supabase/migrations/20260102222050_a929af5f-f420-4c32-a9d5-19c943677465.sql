-- 1. Criar função para verificar acesso às configurações de API
CREATE OR REPLACE FUNCTION public.can_access_api_settings(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('diretor', 'analista_marketing')
  )
$$;

-- 2. Atualizar policy de api_keys
DROP POLICY IF EXISTS "Management can manage API keys" ON api_keys;
CREATE POLICY "Authorized users can manage API keys"
  ON api_keys FOR ALL
  USING (can_access_api_settings(auth.uid()));

-- 3. Atualizar policy de lead_fontes para gerenciamento
DROP POLICY IF EXISTS "Management can manage lead sources" ON lead_fontes;
CREATE POLICY "Authorized users can manage lead sources"
  ON lead_fontes FOR ALL
  USING (can_access_api_settings(auth.uid()));
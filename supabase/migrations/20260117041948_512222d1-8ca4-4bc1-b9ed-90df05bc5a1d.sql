-- ===========================================
-- 1) DROPAR A POLICY ANTERIOR (usa auth.uid() incorretamente)
-- ===========================================
DROP POLICY IF EXISTS "Sales can update own contracts" ON public.contratos;

-- ===========================================
-- 2) CRIAR NOVA POLICY USANDO get_current_profile_id()
-- ===========================================
CREATE POLICY "Sales can update own contracts" 
ON public.contratos 
FOR UPDATE 
TO authenticated 
USING (
  -- Vendedor pode atualizar contratos que criou ou é responsável (comparando com profile.id)
  (created_by = public.get_current_profile_id() OR vendedor_id = public.get_current_profile_id())
  -- Somente em status que permitem edição
  AND status IN ('rascunho', 'pendente', 'enviado', 'pendente_assinatura', 'visualizado', 'assinado')
)
WITH CHECK (
  (created_by = public.get_current_profile_id() OR vendedor_id = public.get_current_profile_id())
  AND status IN ('rascunho', 'pendente', 'enviado', 'pendente_assinatura', 'visualizado', 'assinado')
);

-- ===========================================
-- 3) CRIAR FUNÇÃO PARA TRIGGER DE AUTO-FILL
-- ===========================================
CREATE OR REPLACE FUNCTION public.contratos_auto_fill_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_profile_id uuid;
BEGIN
  -- Obter o profile_id do usuário atual
  current_profile_id := public.get_current_profile_id();
  
  -- Se created_by estiver NULL, preencher com o profile do usuário atual
  IF NEW.created_by IS NULL THEN
    NEW.created_by := current_profile_id;
  END IF;
  
  -- Se vendedor_id estiver NULL, preencher com created_by
  IF NEW.vendedor_id IS NULL THEN
    NEW.vendedor_id := COALESCE(NEW.created_by, current_profile_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- ===========================================
-- 4) CRIAR TRIGGER BEFORE INSERT
-- ===========================================
DROP TRIGGER IF EXISTS contratos_auto_fill_ownership_trigger ON public.contratos;

CREATE TRIGGER contratos_auto_fill_ownership_trigger
BEFORE INSERT ON public.contratos
FOR EACH ROW
EXECUTE FUNCTION public.contratos_auto_fill_ownership();

-- ===========================================
-- 5) BACKFILL: Corrigir contratos existentes com NULL
-- ===========================================
-- Primeiro, atualizar contratos que têm cotação com vendedor
UPDATE public.contratos c
SET 
  created_by = COALESCE(c.created_by, p.id),
  vendedor_id = COALESCE(c.vendedor_id, p.id)
FROM public.cotacoes cot
JOIN public.profiles p ON p.user_id = cot.vendedor_id
WHERE c.cotacao_id = cot.id
  AND (c.created_by IS NULL OR c.vendedor_id IS NULL);

-- Depois, para contratos sem cotação mas com lead que tem vendedor
UPDATE public.contratos c
SET 
  created_by = COALESCE(c.created_by, p.id),
  vendedor_id = COALESCE(c.vendedor_id, p.id)
FROM public.leads l
JOIN public.profiles p ON p.user_id = l.vendedor_id
WHERE c.lead_id = l.id
  AND c.cotacao_id IS NULL
  AND (c.created_by IS NULL OR c.vendedor_id IS NULL);

-- 1. Create role_module_visibility table
CREATE TABLE IF NOT EXISTS public.role_module_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module_id TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, module_id)
);

-- 2. Enable RLS
ALTER TABLE public.role_module_visibility ENABLE ROW LEVEL SECURITY;

-- 3. RLS: read for all authenticated
CREATE POLICY "Authenticated can read module visibility"
  ON public.role_module_visibility
  FOR SELECT TO authenticated
  USING (true);

-- 4. RLS: write for admins only
CREATE POLICY "Admins can manage module visibility"
  ON public.role_module_visibility
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor'::public.app_role) OR 
    public.has_role(auth.uid(), 'desenvolvedor'::public.app_role) OR 
    public.has_role(auth.uid(), 'admin_master'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'diretor'::public.app_role) OR 
    public.has_role(auth.uid(), 'desenvolvedor'::public.app_role) OR 
    public.has_role(auth.uid(), 'admin_master'::public.app_role)
  );

-- 5. Function: get visible modules for a user (union of all roles)
CREATE OR REPLACE FUNCTION public.get_visible_modules(_user_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT rmv.module_id),
    ARRAY[]::TEXT[]
  )
  FROM user_roles ur
  JOIN role_module_visibility rmv ON rmv.role = ur.role AND rmv.visible = true
  WHERE ur.user_id = _user_id;
$$;

-- 6. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_role_module_visibility_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_role_module_visibility_updated_at
  BEFORE UPDATE ON public.role_module_visibility
  FOR EACH ROW
  EXECUTE FUNCTION public.update_role_module_visibility_updated_at();

-- 7. Seed data - Full access roles (all 18 modules)
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT r.role, m.module_id, true
FROM (SELECT unnest(ARRAY['desenvolvedor','diretor','admin_master','admin']::public.app_role[]) as role) r
CROSS JOIN (SELECT unnest(ARRAY['dashboard','vendas','cadastro','monitoramento','eventos','assistencia','oficinas','financeiro','cobranca','contabilidade','juridico','rh','marketing','ouvidoria','diretoria','relatorios','documentos','configuracoes']) as module_id) m
ON CONFLICT (role, module_id) DO NOTHING;

-- gerente_comercial: all except diretoria
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'gerente_comercial'::public.app_role, unnest(ARRAY['dashboard','vendas','cadastro','monitoramento','eventos','assistencia','oficinas','financeiro','cobranca','contabilidade','juridico','rh','marketing','ouvidoria','relatorios','documentos','configuracoes']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- supervisor_vendas
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'supervisor_vendas'::public.app_role, unnest(ARRAY['dashboard','vendas','cadastro','monitoramento','eventos','assistencia','oficinas','relatorios','configuracoes']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- vendedor_clt
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'vendedor_clt'::public.app_role, unnest(ARRAY['dashboard','vendas']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- vendedor_externo
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'vendedor_externo'::public.app_role, unnest(ARRAY['dashboard','vendas']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- analista_cadastro
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'analista_cadastro'::public.app_role, unnest(ARRAY['dashboard','cadastro','documentos']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- coordenador_monitoramento
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'coordenador_monitoramento'::public.app_role, unnest(ARRAY['dashboard','vendas','cadastro','monitoramento','relatorios']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- analista_plataforma
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'analista_plataforma'::public.app_role, unnest(ARRAY['dashboard','monitoramento']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- instalador_vistoriador
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'instalador_vistoriador'::public.app_role, unnest(ARRAY['monitoramento']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- analista_marketing
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'analista_marketing'::public.app_role, unnest(ARRAY['dashboard','vendas','marketing','relatorios']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- analista_juridico
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'analista_juridico'::public.app_role, unnest(ARRAY['dashboard','cadastro','eventos','juridico','relatorios']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- advogado
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'advogado'::public.app_role, unnest(ARRAY['dashboard','cadastro','eventos','juridico','relatorios']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- analista_eventos
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'analista_eventos'::public.app_role, unnest(ARRAY['dashboard','eventos','assistencia','oficinas']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- vistoriador_base
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'vistoriador_base'::public.app_role, unnest(ARRAY['monitoramento']), true
ON CONFLICT (role, module_id) DO NOTHING;

-- agencia
INSERT INTO public.role_module_visibility (role, module_id, visible)
SELECT 'agencia'::public.app_role, unnest(ARRAY['dashboard','vendas']), true
ON CONFLICT (role, module_id) DO NOTHING;

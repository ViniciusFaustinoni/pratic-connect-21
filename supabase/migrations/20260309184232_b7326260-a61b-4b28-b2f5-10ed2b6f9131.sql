
-- 1. Criar tabela equipes_comerciais
CREATE TABLE public.equipes_comerciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supervisor_id, vendedor_id)
);

-- Index para performance nas queries RLS
CREATE INDEX idx_equipes_comerciais_supervisor ON public.equipes_comerciais(supervisor_id);
CREATE INDEX idx_equipes_comerciais_vendedor ON public.equipes_comerciais(vendedor_id);

-- RLS na tabela equipes_comerciais
ALTER TABLE public.equipes_comerciais ENABLE ROW LEVEL SECURITY;

-- Supervisores veem seus vínculos, gerência vê todos
CREATE POLICY "equipes_select" ON public.equipes_comerciais
  FOR SELECT TO authenticated
  USING (
    supervisor_id = auth.uid()
    OR vendedor_id = auth.uid()
    OR is_gerencia(auth.uid())
    OR has_role(auth.uid(), 'admin_master')
  );

-- Apenas gerência/diretores podem inserir vínculos
CREATE POLICY "equipes_insert" ON public.equipes_comerciais
  FOR INSERT TO authenticated
  WITH CHECK (
    is_gerencia(auth.uid())
    OR has_role(auth.uid(), 'admin_master')
  );

-- Apenas gerência/diretores podem deletar vínculos
CREATE POLICY "equipes_delete" ON public.equipes_comerciais
  FOR DELETE TO authenticated
  USING (
    is_gerencia(auth.uid())
    OR has_role(auth.uid(), 'admin_master')
  );

-- 2. Criar função is_supervisor_of (SECURITY DEFINER para evitar recursão)
CREATE OR REPLACE FUNCTION public.is_supervisor_of(_vendedor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.equipes_comerciais
    WHERE supervisor_id = auth.uid()
      AND vendedor_id = _vendedor_id
  )
$$;

-- 3. Atualizar RLS de leads - SELECT
DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;
CREATE POLICY "leads_select_policy" ON public.leads
  FOR SELECT TO authenticated
  USING (
    is_gerencia(auth.uid())
    OR vendedor_id = get_my_profile_id()
    OR vendedor_id IS NULL
    OR is_supervisor_of(
      (SELECT p.user_id FROM public.profiles p WHERE p.id = vendedor_id LIMIT 1)
    )
  );

-- Atualizar RLS de leads - UPDATE
DROP POLICY IF EXISTS "leads_update_policy" ON public.leads;
CREATE POLICY "leads_update_policy" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    is_gerencia(auth.uid())
    OR vendedor_id = get_my_profile_id()
    OR is_supervisor_of(
      (SELECT p.user_id FROM public.profiles p WHERE p.id = vendedor_id LIMIT 1)
    )
  )
  WITH CHECK (
    is_gerencia(auth.uid())
    OR vendedor_id = get_my_profile_id()
    OR is_supervisor_of(
      (SELECT p.user_id FROM public.profiles p WHERE p.id = vendedor_id LIMIT 1)
    )
  );

-- Atualizar RLS de leads - DELETE
DROP POLICY IF EXISTS "leads_delete_policy" ON public.leads;
CREATE POLICY "leads_delete_policy" ON public.leads
  FOR DELETE TO authenticated
  USING (
    is_gerencia(auth.uid())
    OR vendedor_id = get_my_profile_id()
    OR is_supervisor_of(
      (SELECT p.user_id FROM public.profiles p WHERE p.id = vendedor_id LIMIT 1)
    )
  );

-- 4. Atualizar RLS de cotações - UPDATE
DROP POLICY IF EXISTS "Sales can update own quotes" ON public.cotacoes;
CREATE POLICY "Sales can update own quotes" ON public.cotacoes
  FOR UPDATE TO authenticated
  USING (
    vendedor_id = auth.uid()
    OR is_gerencia(auth.uid())
    OR has_role(auth.uid(), 'supervisor_vendas')
  );

-- Manter a policy pública de acesso por link
-- (já existe: "Public access via contrato link" - não tocar)

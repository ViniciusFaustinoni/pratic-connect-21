
-- 1) plano_preco_map: enable RLS + admin/diretor only
ALTER TABLE public.plano_preco_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plano_preco_map_admin_all" ON public.plano_preco_map;
CREATE POLICY "plano_preco_map_admin_all" ON public.plano_preco_map
  FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid()) OR public.is_diretor(auth.uid()))
  WITH CHECK (public.is_admin_master(auth.uid()) OR public.is_diretor(auth.uid()));

-- 2) tabelas_preco_mensalidade: writes -> admin/diretor only; reads unchanged
DROP POLICY IF EXISTS "tabelas_preco_mensalidade_modify" ON public.tabelas_preco_mensalidade;
CREATE POLICY "tabelas_preco_mensalidade_modify" ON public.tabelas_preco_mensalidade
  FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid()) OR public.is_diretor(auth.uid()))
  WITH CHECK (public.is_admin_master(auth.uid()) OR public.is_diretor(auth.uid()));

-- 3) prestadores_assistencia_valores: lock down (was USING true / WITH CHECK true to public)
DROP POLICY IF EXISTS "Acesso prestadores_assistencia_valores" ON public.prestadores_assistencia_valores;
CREATE POLICY "prestadores_assistencia_valores_select_auth" ON public.prestadores_assistencia_valores
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "prestadores_assistencia_valores_write_admin" ON public.prestadores_assistencia_valores
  FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid()) OR public.is_diretor(auth.uid()) OR public.is_gerencia(auth.uid()))
  WITH CHECK (public.is_admin_master(auth.uid()) OR public.is_diretor(auth.uid()) OR public.is_gerencia(auth.uid()));

-- 4) pontuacao_eventos: writes only for staff (admin/diretor/gerencia); reads kept for authenticated
DROP POLICY IF EXISTS "Escrita pontuacao" ON public.pontuacao_eventos;
DROP POLICY IF EXISTS "Update pontuacao" ON public.pontuacao_eventos;
CREATE POLICY "pontuacao_eventos_insert_staff" ON public.pontuacao_eventos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_master(auth.uid()) OR public.is_diretor(auth.uid()) OR public.is_gerencia(auth.uid()));
CREATE POLICY "pontuacao_eventos_update_staff" ON public.pontuacao_eventos
  FOR UPDATE TO authenticated
  USING (public.is_admin_master(auth.uid()) OR public.is_diretor(auth.uid()) OR public.is_gerencia(auth.uid()))
  WITH CHECK (public.is_admin_master(auth.uid()) OR public.is_diretor(auth.uid()) OR public.is_gerencia(auth.uid()));

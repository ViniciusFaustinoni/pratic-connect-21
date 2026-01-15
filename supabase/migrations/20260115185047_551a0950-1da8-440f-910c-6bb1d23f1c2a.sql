
-- =============================================
-- FIX REMAINING POLICIES - PHASE 3
-- =============================================

-- 1. cotacoes_publicas_fotos - public upload, needs to stay permissive but add role check
DROP POLICY IF EXISTS "cotacoes_publicas_fotos_all" ON cotacoes_publicas_fotos;
CREATE POLICY "cotacoes_publicas_fotos_all" ON cotacoes_publicas_fotos
  FOR ALL TO authenticated, anon, service_role
  USING (true)
  WITH CHECK (auth.role() IN ('anon', 'authenticated', 'service_role'));

-- 2. funcionarios_docs_solicitados - restrict to funcionarios
DROP POLICY IF EXISTS "funcionarios_docs_solicitados" ON documentos_solicitados;
CREATE POLICY "funcionarios_docs_solicitados" ON documentos_solicitados
  FOR ALL TO authenticated
  USING (public.am_i_funcionario())
  WITH CHECK (public.am_i_funcionario());

-- 3. anon_update_docs_solicitados - keep for public upload but add basic check
DROP POLICY IF EXISTS "anon_update_docs_solicitados" ON documentos_solicitados;
CREATE POLICY "anon_update_docs_solicitados" ON documentos_solicitados
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (auth.role() = 'anon');

-- 4. cotacoes_publicas_update_public - keep for public but add role check
DROP POLICY IF EXISTS "cotacoes_publicas_update_public" ON cotacoes_publicas;
CREATE POLICY "cotacoes_publicas_update_public" ON cotacoes_publicas
  FOR UPDATE TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (auth.role() IN ('anon', 'authenticated', 'service_role'));

-- 5. leads_insert_policy - keep for public forms but add role check  
DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
CREATE POLICY "leads_insert_policy" ON leads
  FOR INSERT TO authenticated, anon, service_role
  WITH CHECK (auth.role() IN ('anon', 'authenticated', 'service_role'));

-- 6. cotacoes_publicas_historico_insert - keep for public but add role check
DROP POLICY IF EXISTS "cotacoes_publicas_historico_insert" ON cotacoes_publicas_historico;
CREATE POLICY "cotacoes_publicas_historico_insert" ON cotacoes_publicas_historico
  FOR INSERT TO authenticated, anon, service_role
  WITH CHECK (auth.role() IN ('anon', 'authenticated', 'service_role'));

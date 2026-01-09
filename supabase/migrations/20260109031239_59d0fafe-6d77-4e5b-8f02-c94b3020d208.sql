-- ═══════════════════════════════════════════════════════════════
-- CORREÇÃO DAS POLÍTICAS RLS PARA TABELA LEADS
-- Problema: vendedor_id armazena profiles.id, mas RLS comparava com auth.uid()
-- Solução: Usar get_current_profile_id() que converte auth.uid() para profiles.id
-- ═══════════════════════════════════════════════════════════════

-- 1. Dropar políticas existentes
DROP POLICY IF EXISTS "Sales can view own leads" ON leads;
DROP POLICY IF EXISTS "Sales can insert leads" ON leads;
DROP POLICY IF EXISTS "Sales can update own leads" ON leads;
DROP POLICY IF EXISTS "Sales can delete own leads" ON leads;

-- 2. Política de SELECT (Leitura)
CREATE POLICY "leads_select_policy" ON leads
FOR SELECT USING (
    -- Vendedor vê seus próprios leads (usando profile.id)
    vendedor_id = get_current_profile_id()
    OR
    -- Leads sem vendedor podem ser vistos por vendedores (pool)
    (vendedor_id IS NULL AND is_vendedor(auth.uid()))
    OR
    -- Supervisor vê todos os leads (para gestão da equipe)
    has_role(auth.uid(), 'supervisor_vendas')
    OR
    -- Gerência (Gerente Comercial e Diretor) vê todos
    is_gerencia(auth.uid())
);

-- 3. Política de INSERT (Criação)
CREATE POLICY "leads_insert_policy" ON leads
FOR INSERT WITH CHECK (
    -- Qualquer vendedor ou gerência pode criar leads
    is_vendedor(auth.uid()) OR is_gerencia(auth.uid())
);

-- 4. Política de UPDATE (Atualização)
CREATE POLICY "leads_update_policy" ON leads
FOR UPDATE USING (
    -- Vendedor atualiza seus leads
    vendedor_id = get_current_profile_id()
    OR
    -- Leads sem vendedor podem ser atualizados por vendedores
    (vendedor_id IS NULL AND is_vendedor(auth.uid()))
    OR
    -- Supervisor pode atualizar todos
    has_role(auth.uid(), 'supervisor_vendas')
    OR
    -- Gerência pode atualizar todos
    is_gerencia(auth.uid())
);

-- 5. Política de DELETE (Exclusão)
CREATE POLICY "leads_delete_policy" ON leads
FOR DELETE USING (
    -- Vendedor pode excluir seus próprios leads
    vendedor_id = get_current_profile_id()
    OR
    -- Gerência pode excluir qualquer lead
    is_gerencia(auth.uid())
);
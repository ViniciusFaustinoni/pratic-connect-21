-- Remover políticas existentes para recriar
DROP POLICY IF EXISTS "Staff can view contracts" ON contratos;
DROP POLICY IF EXISTS "Management can insert contracts" ON contratos;
DROP POLICY IF EXISTS "Management can update contracts" ON contratos;
DROP POLICY IF EXISTS "Only directors can delete contracts" ON contratos;

-- Política: Funcionários podem visualizar contratos
CREATE POLICY "Staff can view contracts" ON contratos
  FOR SELECT TO authenticated
  USING (is_funcionario(auth.uid()));

-- Política: Gerência pode inserir contratos
CREATE POLICY "Management can insert contracts" ON contratos
  FOR INSERT TO authenticated
  WITH CHECK (is_gerencia(auth.uid()));

-- Política: Gerência pode atualizar contratos
CREATE POLICY "Management can update contracts" ON contratos
  FOR UPDATE TO authenticated
  USING (is_gerencia(auth.uid()))
  WITH CHECK (is_gerencia(auth.uid()));

-- Política: APENAS diretores podem deletar contratos
CREATE POLICY "Only directors can delete contracts" ON contratos
  FOR DELETE TO authenticated
  USING (is_diretor(auth.uid()));
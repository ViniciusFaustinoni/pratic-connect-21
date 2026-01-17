-- Permitir que usuários anônimos atualizem cotações via token público
-- Isso é necessário para que o cliente possa:
-- 1. Atualizar visualizado_em
-- 2. Selecionar plano
-- 3. Salvar dados pessoais
-- 4. Enviar documentos
-- 5. Registrar vistoria
CREATE POLICY "Atualização pública via token" ON cotacoes
  FOR UPDATE
  TO anon
  USING (token_publico IS NOT NULL)
  WITH CHECK (token_publico IS NOT NULL);
-- Add token_publico column to substituicoes_veiculo
ALTER TABLE substituicoes_veiculo
  ADD COLUMN IF NOT EXISTS token_publico VARCHAR(36) UNIQUE DEFAULT gen_random_uuid()::varchar;

-- Anon select policy by token
CREATE POLICY "anon_select_substituicao_by_token" ON substituicoes_veiculo
  FOR SELECT TO anon
  USING (token_publico IS NOT NULL);

-- Anon update policy by token (limited)
CREATE POLICY "anon_update_substituicao_by_token" ON substituicoes_veiculo
  FOR UPDATE TO anon
  USING (token_publico IS NOT NULL)
  WITH CHECK (token_publico IS NOT NULL);
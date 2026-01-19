-- Adicionar FK de cotacoes.vendedor_id para profiles.user_id
-- Isso permite join direto entre cotacoes e profiles

ALTER TABLE cotacoes 
ADD CONSTRAINT cotacoes_vendedor_profiles_fkey 
FOREIGN KEY (vendedor_id) REFERENCES profiles(user_id);
-- Adicionar coluna primeiro_acesso à tabela profiles
ALTER TABLE profiles 
ADD COLUMN primeiro_acesso boolean NOT NULL DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN profiles.primeiro_acesso IS 
  'Indica se é o primeiro acesso do usuário (deve trocar senha)';
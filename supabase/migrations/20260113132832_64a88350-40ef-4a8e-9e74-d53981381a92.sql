-- Atribuir papel de diretor ao usuário admin@teste.com
-- user_id correto de auth.users: 4218616b-44c1-473b-a8cc-d2eb5a8d10dc

INSERT INTO user_roles (user_id, role)
SELECT 
  '4218616b-44c1-473b-a8cc-d2eb5a8d10dc', 
  'diretor'
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = '4218616b-44c1-473b-a8cc-d2eb5a8d10dc'
  AND role = 'diretor'
);
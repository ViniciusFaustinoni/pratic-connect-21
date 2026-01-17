-- Atualizar cotações órfãs (sem vendedor_id) para o usuário admin de teste
-- Usando o ID correto do auth.users
UPDATE cotacoes 
SET vendedor_id = '4218616b-44c1-473b-a8cc-d2eb5a8d10dc'
WHERE vendedor_id IS NULL;

-- Inserir role de diretor para o admin de teste (se ainda não existir)
INSERT INTO user_roles (user_id, role)
VALUES ('4218616b-44c1-473b-a8cc-d2eb5a8d10dc', 'diretor')
ON CONFLICT (user_id, role) DO NOTHING;
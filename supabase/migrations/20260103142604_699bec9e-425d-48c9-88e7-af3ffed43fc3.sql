-- Atribuir role 'diretor' ao usuário informativo@praticcar.org
INSERT INTO user_roles (user_id, role)
VALUES ('c456344b-23bf-4527-aba0-119051229d03', 'diretor')
ON CONFLICT (user_id, role) DO NOTHING;
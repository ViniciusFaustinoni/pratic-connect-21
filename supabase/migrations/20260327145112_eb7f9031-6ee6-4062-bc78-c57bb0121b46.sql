-- Insert diretor role for admin@teste.com (correct auth.users id)
INSERT INTO public.user_roles (user_id, role)
VALUES ('4218616b-44c1-473b-a8cc-d2eb5a8d10dc', 'diretor')
ON CONFLICT (user_id, role) DO NOTHING;
-- Adicionar role 'diretor' para o usuário marcosdativo@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'diretor'::app_role
FROM public.profiles
WHERE email = 'marcosdativo@gmail.com'
  AND user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
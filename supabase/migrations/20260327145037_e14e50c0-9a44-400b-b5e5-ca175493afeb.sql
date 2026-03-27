-- Insert diretor role for admin@teste.com if user exists in auth.users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '37beadcf-284b-4a2c-88a0-6efa8cae60d9') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES ('37beadcf-284b-4a2c-88a0-6efa8cae60d9', 'diretor')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
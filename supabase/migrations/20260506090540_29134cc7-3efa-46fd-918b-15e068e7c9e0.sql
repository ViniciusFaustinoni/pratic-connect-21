
CREATE OR REPLACE FUNCTION public.is_usuario_interno()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (p.tipo IS NULL OR p.tipo::text <> 'associado')
  );
$$;

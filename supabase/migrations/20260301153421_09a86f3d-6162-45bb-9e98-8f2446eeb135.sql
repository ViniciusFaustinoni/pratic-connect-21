-- 1. Criar funcao auxiliar is_prestador
CREATE OR REPLACE FUNCTION public.is_prestador(_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND tipo = 'prestador'
      AND ativo = true
  )
$$;

-- 2. Politica de UPDATE para prestadores
CREATE POLICY "Prestadores podem atualizar seus servicos"
ON public.servicos
FOR UPDATE
TO authenticated
USING (
  public.is_prestador(auth.uid())
  AND profissional_id = (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_prestador(auth.uid())
  AND profissional_id = (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- 3. Politica de SELECT para prestadores
CREATE POLICY "Prestadores podem ver seus servicos"
ON public.servicos
FOR SELECT
TO authenticated
USING (
  public.is_prestador(auth.uid())
  AND profissional_id = (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);
CREATE POLICY "instalacoes_no_delete"
ON public.instalacoes
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (false);
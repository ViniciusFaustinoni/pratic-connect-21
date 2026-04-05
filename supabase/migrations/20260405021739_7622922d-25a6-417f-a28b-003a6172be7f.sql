-- Allow anon to read vistorias_evento for slot availability check (public scheduling page)
CREATE POLICY "Anon pode contar vistorias por data para vagas"
ON public.vistorias_evento
FOR SELECT
TO anon
USING (true);
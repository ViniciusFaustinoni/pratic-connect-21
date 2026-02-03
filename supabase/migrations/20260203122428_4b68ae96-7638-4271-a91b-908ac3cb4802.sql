-- Permitir que gerencia atualize profiles de funcionarios/consultores
-- Necessario para que diretores possam editar codigo_sga_voluntario

CREATE POLICY "Management can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (is_gerencia(auth.uid()))
  WITH CHECK (is_gerencia(auth.uid()));
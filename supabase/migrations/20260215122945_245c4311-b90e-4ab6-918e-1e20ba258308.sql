CREATE POLICY "Reguladores podem ver sinistros"
  ON public.sinistros
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'regulador')
    OR has_role(auth.uid(), 'diretor')
    OR has_role(auth.uid(), 'gerente_comercial')
    OR has_role(auth.uid(), 'coordenador_monitoramento')
    OR has_role(auth.uid(), 'analista_cadastro')
  );
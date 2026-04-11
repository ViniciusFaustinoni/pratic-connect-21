
-- Remover policies antigas que usam role 'admin'
DROP POLICY IF EXISTS "Admin insert" ON public.locais_instalacao;
DROP POLICY IF EXISTS "Admin update" ON public.locais_instalacao;

-- Recriar com roles corretos
CREATE POLICY "Diretor ou coord insert locais_instalacao"
  ON public.locais_instalacao
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'coordenador_monitoramento')
  );

CREATE POLICY "Diretor ou coord update locais_instalacao"
  ON public.locais_instalacao
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'coordenador_monitoramento')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'coordenador_monitoramento')
  );

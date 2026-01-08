-- Criar política para permitir exclusão de leads
-- Mesmo critério do UPDATE: proprietário do lead ou gerência
CREATE POLICY "Sales can delete own leads" 
ON public.leads 
FOR DELETE 
TO authenticated 
USING (
  (vendedor_id = auth.uid()) 
  OR is_gerencia(auth.uid())
);
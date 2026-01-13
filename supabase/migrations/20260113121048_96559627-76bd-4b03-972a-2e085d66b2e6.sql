-- Criar política RLS para permitir exclusão de cotações
-- Vendedores podem excluir suas próprias cotações
-- Gerência/supervisores podem excluir qualquer cotação
CREATE POLICY "Users can delete own quotes" 
ON public.cotacoes 
FOR DELETE 
TO authenticated
USING (
  (vendedor_id = auth.uid()) 
  OR is_gerencia(auth.uid())
  OR has_role(auth.uid(), 'supervisor_vendas')
);
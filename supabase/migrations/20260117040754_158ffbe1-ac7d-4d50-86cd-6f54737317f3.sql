-- Criar política para permitir que vendedores atualizem seus próprios contratos
-- Isso resolve o erro "Contrato não encontrado ou sem permissão de acesso" ao gerar link

CREATE POLICY "Sales can update own contracts" 
ON public.contratos 
FOR UPDATE 
TO authenticated 
USING (
  -- Vendedor pode atualizar contratos que criou ou é responsável
  (created_by = auth.uid() OR vendedor_id = auth.uid())
  -- Somente em status que permitem edição (não ativos/cancelados)
  AND status IN ('rascunho', 'pendente', 'enviado', 'pendente_assinatura', 'visualizado', 'assinado')
)
WITH CHECK (
  (created_by = auth.uid() OR vendedor_id = auth.uid())
  AND status IN ('rascunho', 'pendente', 'enviado', 'pendente_assinatura', 'visualizado', 'assinado')
);
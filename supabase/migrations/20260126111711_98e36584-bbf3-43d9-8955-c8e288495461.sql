-- Criar política para associados poderem inserir solicitações
CREATE POLICY "Associados podem criar solicitacoes" 
ON public.chat_solicitacoes_ia 
FOR INSERT 
TO authenticated
WITH CHECK (
  associado_id IN (
    SELECT id FROM associados WHERE user_id = auth.uid()
  )
);
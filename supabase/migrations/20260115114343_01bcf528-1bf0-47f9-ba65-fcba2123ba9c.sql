-- Política para permitir INSERT anônimo na tabela documentos
-- Condição: Deve existir um documento_solicitado pendente para o associado_id
CREATE POLICY "anon_insert_documentos" ON public.documentos
FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documentos_solicitados ds
    WHERE ds.associado_id = documentos.associado_id
    AND ds.status = 'pendente'
  )
);

-- Política para permitir SELECT anônimo (para retornar o registro criado)
CREATE POLICY "anon_select_documentos" ON public.documentos
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM documentos_solicitados ds
    WHERE ds.associado_id = documentos.associado_id
    AND ds.status IN ('pendente', 'enviado')
  )
);
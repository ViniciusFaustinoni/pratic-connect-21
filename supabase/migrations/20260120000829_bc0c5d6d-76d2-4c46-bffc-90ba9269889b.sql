-- Política para permitir inserção de documentos em cotações públicas (clientes não autenticados)
CREATE POLICY "Clientes podem enviar documentos para cotacoes publicas"
ON public.contratos_documentos
FOR INSERT
TO anon
WITH CHECK (
  cotacao_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM cotacoes 
    WHERE cotacoes.id = cotacao_id 
    AND cotacoes.token_publico IS NOT NULL
    AND cotacoes.status IN ('rascunho', 'enviada', 'aceita')
  )
);

-- Política para clientes verem documentos da própria cotação
CREATE POLICY "Clientes podem ver documentos de cotacoes publicas"
ON public.contratos_documentos
FOR SELECT
TO anon
USING (
  cotacao_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM cotacoes 
    WHERE cotacoes.id = cotacao_id 
    AND cotacoes.token_publico IS NOT NULL
  )
);
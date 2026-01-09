-- Criar bucket para documentos de cotações públicas
INSERT INTO storage.buckets (id, name, public)
VALUES ('cotacoes-docs', 'cotacoes-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Política para acesso público ao bucket
CREATE POLICY "cotacoes_docs_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'cotacoes-docs');

CREATE POLICY "cotacoes_docs_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'cotacoes-docs');

CREATE POLICY "cotacoes_docs_public_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'cotacoes-docs');

CREATE POLICY "cotacoes_docs_public_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'cotacoes-docs');
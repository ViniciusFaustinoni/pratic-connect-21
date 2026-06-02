DROP POLICY IF EXISTS "cotacoes_docs_public_insert_validated" ON storage.objects;

CREATE POLICY "cotacoes_docs_public_insert_validated"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'cotacoes-docs'
  AND name ~* '\.(jpg|jpeg|png|pdf|webp|heic|jfif|bmp|gif|tiff|tif|mp4|mov|webm|m4v|3gp|quicktime)$'
);
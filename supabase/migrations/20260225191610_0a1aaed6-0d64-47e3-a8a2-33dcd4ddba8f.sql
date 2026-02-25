-- Drop and recreate the insert policy to allow more image formats
DROP POLICY IF EXISTS "cotacoes_docs_public_insert_validated" ON storage.objects;
CREATE POLICY "cotacoes_docs_public_insert_validated"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'cotacoes-docs'
    AND name ~* '\.(jpg|jpeg|png|pdf|webp|heic|jfif|bmp|gif|tiff|tif)$'
  );

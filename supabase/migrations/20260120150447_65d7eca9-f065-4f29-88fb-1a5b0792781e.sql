-- Criar bucket vistoria-fotos para armazenar fotos da vistoria completa
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vistoria-fotos', 
  'vistoria-fotos', 
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Política para UPLOAD - Usuários autenticados podem fazer upload
CREATE POLICY "Usuarios autenticados podem fazer upload em vistoria-fotos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vistoria-fotos');

-- Política para SELECT - Qualquer pessoa pode visualizar (bucket público)
CREATE POLICY "Visualizacao publica de vistoria-fotos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'vistoria-fotos');

-- Política para UPDATE - Usuários autenticados podem atualizar
CREATE POLICY "Usuarios autenticados podem atualizar em vistoria-fotos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'vistoria-fotos');

-- Política para DELETE - Usuários autenticados podem deletar
CREATE POLICY "Usuarios autenticados podem deletar em vistoria-fotos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vistoria-fotos');
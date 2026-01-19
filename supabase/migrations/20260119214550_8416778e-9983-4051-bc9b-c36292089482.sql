-- 1. Criar o bucket cotacoes-vistoria (público para exibir fotos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cotacoes-vistoria', 
  'cotacoes-vistoria', 
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- 2. Política para permitir upload de qualquer pessoa (cotação pública)
CREATE POLICY "Permitir upload público em cotacoes-vistoria"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'cotacoes-vistoria');

-- 3. Política para permitir leitura pública
CREATE POLICY "Permitir leitura pública em cotacoes-vistoria"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'cotacoes-vistoria');

-- 4. Política para permitir update (refazer foto)
CREATE POLICY "Permitir update em cotacoes-vistoria"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'cotacoes-vistoria')
WITH CHECK (bucket_id = 'cotacoes-vistoria');
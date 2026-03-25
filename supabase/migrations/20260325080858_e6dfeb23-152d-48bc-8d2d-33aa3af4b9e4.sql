
-- Criar bucket para documentos de migração
INSERT INTO storage.buckets (id, name, public)
VALUES ('migracao-documentos', 'migracao-documentos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: qualquer autenticado pode fazer upload
CREATE POLICY "Authenticated users can upload migration docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'migracao-documentos');

-- RLS: qualquer autenticado pode ler
CREATE POLICY "Authenticated users can read migration docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'migracao-documentos');

-- RLS: qualquer autenticado pode deletar seus uploads
CREATE POLICY "Authenticated users can delete migration docs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'migracao-documentos');

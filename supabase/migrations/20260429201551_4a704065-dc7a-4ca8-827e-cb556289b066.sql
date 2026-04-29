
-- Recria a política de UPDATE com WITH CHECK explícito.
-- Sem WITH CHECK, o Postgres bloqueia a "linha resultante" do UPSERT
-- (ON CONFLICT DO UPDATE), causando 400 "new row violates row-level security policy"
-- quando o prestador tenta refazer / reenviar a assinatura.
DROP POLICY IF EXISTS "Anon can update assinaturas" ON storage.objects;

CREATE POLICY "Anon can update assinaturas"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING  (bucket_id = 'assinaturas')
  WITH CHECK (bucket_id = 'assinaturas');

-- Garante leitura pública (necessária para getPublicUrl renderizar e para o
-- preview no link do prestador). Sem SELECT para anon, refazer assinatura
-- também falhava em alguns navegadores que tentam HEAD antes do PUT.
DROP POLICY IF EXISTS "Anon can read assinaturas" ON storage.objects;
CREATE POLICY "Anon can read assinaturas"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'assinaturas');

-- Mesmo padrão preventivo para o bucket prestador-fotos (refazer foto).
DROP POLICY IF EXISTS "anon_update_prestador_fotos" ON storage.objects;
CREATE POLICY "anon_update_prestador_fotos"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING  (bucket_id = 'prestador-fotos')
  WITH CHECK (bucket_id = 'prestador-fotos');

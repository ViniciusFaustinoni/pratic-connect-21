
-- Allow anonymous users to upload signatures (public page)
CREATE POLICY "Anon can upload assinaturas"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'assinaturas');

-- Allow anonymous users to update signatures (needed for upsert)
CREATE POLICY "Anon can update assinaturas"
ON storage.objects
FOR UPDATE
TO anon
USING (bucket_id = 'assinaturas');

-- Allow anonymous users to update assinatura_cliente_url on servicos
-- This is needed for the public signature page
CREATE POLICY "Anon can update assinatura on servicos"
ON public.servicos
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

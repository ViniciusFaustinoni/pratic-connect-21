-- Permitir upload de fotos de autovistoria via link público
-- A validação é feita verificando se existe uma vistoria ativa 
-- vinculada a um contrato com link_token válido

-- 1. Policy para INSERT no bucket documentos (path: vistorias/*)
CREATE POLICY "Public can upload autovistoria photos" 
ON storage.objects FOR INSERT 
TO anon
WITH CHECK (
  bucket_id = 'documentos' AND
  (storage.foldername(name))[1] = 'vistorias' AND
  -- Verifica se a vistoria existe e está vinculada a um contrato com link válido
  EXISTS (
    SELECT 1 FROM public.vistorias v
    JOIN public.contratos c ON v.contrato_id = c.id
    WHERE v.id::text = (storage.foldername(name))[2]
    AND c.link_token IS NOT NULL
    AND c.adesao_paga = false
  )
);

-- 2. Policy para SELECT no bucket documentos (visualizar fotos de autovistoria)
CREATE POLICY "Public can view autovistoria photos"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'documentos' AND
  (storage.foldername(name))[1] = 'vistorias'
);
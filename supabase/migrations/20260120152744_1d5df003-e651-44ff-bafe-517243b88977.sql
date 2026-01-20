-- Criar bucket para contratos assinados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contratos-assinados', 'contratos-assinados', true, 20971520, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket
CREATE POLICY "Upload contratos assinados authenticated" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'contratos-assinados');

CREATE POLICY "Visualizar contratos assinados public" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'contratos-assinados');

-- Permitir service role fazer upload (para edge functions)
CREATE POLICY "Service role upload contratos" 
ON storage.objects FOR INSERT 
TO service_role 
WITH CHECK (bucket_id = 'contratos-assinados');

-- Adicionar coluna para URL do PDF assinado nos contratos
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS pdf_assinado_url TEXT;
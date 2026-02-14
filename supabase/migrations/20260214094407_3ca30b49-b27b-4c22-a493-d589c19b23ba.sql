
-- Create storage bucket for evento uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('sinistro-eventos', 'sinistro-eventos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: authenticated users can do everything
CREATE POLICY "Authenticated users full access sinistro-eventos"
ON storage.objects FOR ALL
USING (bucket_id = 'sinistro-eventos' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'sinistro-eventos' AND auth.role() = 'authenticated');

-- Policy: anon can read (public URLs)
CREATE POLICY "Public read access sinistro-eventos"
ON storage.objects FOR SELECT
USING (bucket_id = 'sinistro-eventos');

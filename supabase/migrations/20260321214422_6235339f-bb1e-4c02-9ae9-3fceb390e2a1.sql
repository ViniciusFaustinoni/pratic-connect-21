-- Add landing page columns to planos
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS visivel_landing BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS imagem_landing_url TEXT,
  ADD COLUMN IF NOT EXISTS descricao_landing TEXT;

-- Create public bucket for landing images
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-images', 'landing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on landing-images bucket
CREATE POLICY "Public read landing-images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'landing-images');

-- Allow authenticated upload to landing-images
CREATE POLICY "Authenticated upload landing-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'landing-images');

-- Allow authenticated delete from landing-images
CREATE POLICY "Authenticated delete landing-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'landing-images');

-- Allow anon to read planos that are visible on landing
CREATE POLICY "Anon read visible landing planos"
ON public.planos FOR SELECT
TO anon
USING (visivel_landing = true AND ativo = true);
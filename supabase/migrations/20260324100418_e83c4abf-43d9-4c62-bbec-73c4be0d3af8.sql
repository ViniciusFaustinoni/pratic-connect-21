
-- Add columns to vistoria_prestador_links for checklist, fotos and signature
ALTER TABLE public.vistoria_prestador_links 
  ADD COLUMN IF NOT EXISTS checklist_data jsonb DEFAULT null,
  ADD COLUMN IF NOT EXISTS fotos_vistoria jsonb DEFAULT null,
  ADD COLUMN IF NOT EXISTS assinatura_url text DEFAULT null;

-- Create storage bucket for vistoria prestador photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('vistoria-prestador-fotos', 'vistoria-prestador-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anon uploads to the bucket (prestador has no login)
CREATE POLICY "Anon can upload vistoria prestador fotos"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'vistoria-prestador-fotos');

-- Allow public read
CREATE POLICY "Public read vistoria prestador fotos"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'vistoria-prestador-fotos');

-- Allow anon update (for overwriting)
CREATE POLICY "Anon can update vistoria prestador fotos"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'vistoria-prestador-fotos');

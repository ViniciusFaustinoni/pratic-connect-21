DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('whatsapp-media', 'whatsapp-media', true)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can upload whatsapp media') THEN
    CREATE POLICY "Service role can upload whatsapp media"
    ON storage.objects FOR INSERT
    TO service_role
    WITH CHECK (bucket_id = 'whatsapp-media');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read whatsapp media') THEN
    CREATE POLICY "Public read whatsapp media"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'whatsapp-media');
  END IF;
END $$;

-- Add valor column to coberturas for the clean catalog
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS valor NUMERIC(10,2) DEFAULT 0;

-- Create marcas_modelos table for brand/model management
CREATE TABLE IF NOT EXISTS marcas_modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca TEXT NOT NULL,
  modelo TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE marcas_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read marcas_modelos" 
  ON marcas_modelos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert marcas_modelos"
  ON marcas_modelos FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update marcas_modelos"
  ON marcas_modelos FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete marcas_modelos"
  ON marcas_modelos FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

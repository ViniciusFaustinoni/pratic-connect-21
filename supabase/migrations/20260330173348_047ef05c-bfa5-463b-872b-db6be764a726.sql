-- Coberturas
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS carencia_ativa boolean DEFAULT false;
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS carencia_tipo text DEFAULT NULL;
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS carencia_multiplicador numeric DEFAULT NULL;

-- Benefits
ALTER TABLE benefits ADD COLUMN IF NOT EXISTS carencia_ativa boolean DEFAULT false;
ALTER TABLE benefits ADD COLUMN IF NOT EXISTS carencia_tipo text DEFAULT NULL;
ALTER TABLE benefits ADD COLUMN IF NOT EXISTS carencia_multiplicador numeric DEFAULT NULL;
ALTER TABLE plano_elegibilidade_modelos
ADD COLUMN IF NOT EXISTS cobertura_fipe integer DEFAULT 100;

COMMENT ON COLUMN plano_elegibilidade_modelos.cobertura_fipe IS 'Percentual de cobertura FIPE para este modelo (ex: 70 = 70% FIPE). Default 100.';
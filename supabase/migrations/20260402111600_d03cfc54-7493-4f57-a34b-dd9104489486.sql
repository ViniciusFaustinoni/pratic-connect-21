ALTER TABLE associados ADD COLUMN IF NOT EXISTS origem_cadastro text NOT NULL DEFAULT 'interno';

UPDATE associados SET origem_cadastro = 'api_externa' WHERE codigo_hinova IS NOT NULL OR data_cadastro_sga IS NOT NULL;
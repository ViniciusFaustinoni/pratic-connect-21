-- Remove BMW from exclusive motorcycle brands (it's a mixed brand)
UPDATE configuracoes 
SET valor = '["HAOJUE", "SHINERAY", "SUZUKI", "KAWASAKI", "TRIUMPH", "DUCATI", "HARLEY-DAVIDSON"]'
WHERE chave = 'marcas_exclusivas_moto';

-- Update motorcycle FIPE limit from 30k to 50k
UPDATE configuracoes 
SET valor = '50000'
WHERE chave = 'fipe_limite_autorizacao_moto';

-- Add BMW car models to eligibility table so BMW cars are detected correctly
INSERT INTO plano_elegibilidade_modelos (plano_id, marca, modelo, linha_slug, is_active)
VALUES ('6f8d28cb-7500-4f5d-85ab-4f771d1e21ab', 'BMW', 'TODOS OS MODELOS NACIONAIS', 'select', true);
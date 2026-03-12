
-- 1. Remove km suffix from Assistência 24h custom_text
UPDATE planos_beneficios
SET custom_text = 'Assistência 24h'
WHERE benefit_id = 'ce0c5167-991c-4e0a-b5c2-21b23bc91807'
  AND custom_text LIKE 'Assistência 24h %km';

-- 2. Clear static Reboque custom_text to allow dynamic km display
UPDATE planos_beneficios
SET custom_text = NULL
WHERE benefit_id = 'be1fa928-b1fe-4bbb-a402-ec0604bc9e8e'
  AND custom_text LIKE '%km Reboque%';

-- Remove duplicate coverage items from benefits table (they already exist in coberturas table)
-- Verified: zero links in planos_beneficios for these records
DELETE FROM benefits WHERE category = 'cobertura';
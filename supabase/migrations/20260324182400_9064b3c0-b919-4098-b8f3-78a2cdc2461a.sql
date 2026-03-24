-- Fix SONIC and STILO with NULL ano_max in ESPECIAL whitelist
UPDATE plano_elegibilidade_modelos 
SET ano_max = 2004 
WHERE id IN ('993f8ebb-1b11-40be-a03e-cb0a2ed558e6', '1ca7bce1-4fa1-455e-99ab-603bb7ca94f1')
AND ano_max IS NULL;
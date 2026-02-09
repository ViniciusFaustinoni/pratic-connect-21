-- Fix existing cancelled vehicles that still show coverage as active
UPDATE veiculos SET cobertura_total = false, cobertura_roubo_furto = false
WHERE status = 'cancelado'
AND (cobertura_total = true OR cobertura_roubo_furto = true);
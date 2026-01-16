-- Reordenar planos da Linha Select
-- SELECT EXCLUSIVE APLICATIVO deve vir antes do SELECT ONE

-- Trocar SELECT EXCLUSIVE APLICATIVO para posição 4
UPDATE plans 
SET display_order = 4 
WHERE slug = 'select-exclusive-aplicativo';

-- Trocar SELECT ONE para posição 5
UPDATE plans 
SET display_order = 5 
WHERE slug = 'select-one';
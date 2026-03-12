
-- Fix 1: Remove ghost variable "7" from tecnico_a_caminho_1
UPDATE whatsapp_meta_templates
SET variaveis_exemplo = '{"1":"Marcus","2":"Vistoriador","3":"(21) 99259-3830","4":"https://wa.me/5521992593830","5":"EST CAFUNDA, 725, TANQUE, RIO DE JANEIRO","6":"Manhã (08:00-12:00)"}'::jsonb,
    updated_at = now()
WHERE nome = 'tecnico_a_caminho_1';

-- Fix 2: Update generic URL in reboque_veiculo_carregado
UPDATE whatsapp_meta_templates
SET variaveis_exemplo = '{"1":"Claudiio","2":"qoo5c17","3":"Oficina Central - Av. Brasil, 500","4":"https://pratic-connect-21.lovable.app/acompanhar/reboque/abc123"}'::jsonb,
    updated_at = now()
WHERE nome = 'reboque_veiculo_carregado';

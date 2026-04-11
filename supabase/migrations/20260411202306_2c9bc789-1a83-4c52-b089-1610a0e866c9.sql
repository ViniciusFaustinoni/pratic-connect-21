UPDATE public.whatsapp_meta_templates 
SET variaveis_exemplo = '{"1":"Marcus","2":"Vistoriador","3":"(21) 99259-3830","4":"(21) 99259-3830","5":"EST CAFUNDA, 725, TANQUE, RIO DE JANEIRO","6":"Manhã (08:00-12:00)"}'::jsonb,
    updated_at = now()
WHERE nome = 'tecnico_a_caminho_1';
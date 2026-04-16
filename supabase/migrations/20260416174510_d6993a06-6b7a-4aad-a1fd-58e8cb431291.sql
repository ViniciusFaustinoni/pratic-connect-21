-- 1) Corrigir tipo_uso do "Advanced Especial Aplicativo"
UPDATE public.entity_eligibility_rules 
SET rule_config = '{"tipos_uso": ["aplicativo"], "values": ["aplicativo"]}'::jsonb
WHERE id = '2be237da-d9f8-4a7a-89c8-fbf955cfd5b1';

-- 2) Corrigir preço da Assistência 24h 400km - Advanced Especial Aplicativo
UPDATE public.benefits 
SET preco_sugerido = 15.00 
WHERE id = '2f36e936-d940-48bc-a1cb-027013cd05ee';

-- 3) Configurar cota APP (10%, mín R$ 1.500) nos planos APP via override de categoria
INSERT INTO public.planos_cotas_categoria (plano_id, categoria_veiculo, cota_percentual, cota_minima_valor) VALUES
('16b01086-4983-4f9d-8177-f98d021731a5', 'aplicativo', 10, 1500),
('58a17bce-4362-4949-a68e-04f6592adde8', 'aplicativo', 10, 1500);
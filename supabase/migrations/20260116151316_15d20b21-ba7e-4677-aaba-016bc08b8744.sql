-- =====================================================
-- SEED DATA: PLANOS ESPECIAL, LANÇAMENTO E ADVANCED
-- =====================================================

-- ======================
-- LINHA ESPECIAL
-- ======================
INSERT INTO public.plans (
  product_line_id, name, slug, badge_text, badge_color,
  coverage_type, min_vehicle_year, 
  cota_passeio_percent, cota_passeio_min,
  cota_desagio_percent, cota_desagio_min,
  cota_app_percent, cota_app_min,
  additional_price, restriction_alert,
  footer_note, display_order, is_active
) VALUES
  -- ESPECIAL
  (
    (SELECT id FROM product_lines WHERE slug = 'especial'),
    'ESPECIAL', 'especial',
    NULL, NULL,
    '80% FIPE', '> 2002',
    6.00, 1200.00,
    8.00, 2000.00,
    NULL, NULL,
    NULL, 'Deságio de leilão: sem cobertura de incêndio',
    NULL, 1, true
  ),
  -- ESPECIAL PLUS
  (
    (SELECT id FROM product_lines WHERE slug = 'especial'),
    'ESPECIAL PLUS', 'especial-plus',
    NULL, NULL,
    '80% FIPE', '> 2002',
    10.00, 3000.00,
    NULL, NULL,
    NULL, NULL,
    NULL, 'Deságio de leilão: sem cobertura de incêndio',
    NULL, 2, true
  );

-- ======================
-- LINHA LANÇAMENTO
-- ======================
INSERT INTO public.plans (
  product_line_id, name, slug, badge_text, badge_color,
  coverage_type, min_vehicle_year, 
  cota_passeio_percent, cota_passeio_min,
  cota_desagio_percent, cota_desagio_min,
  cota_app_percent, cota_app_min,
  additional_price, restriction_alert,
  footer_note, display_order, is_active
) VALUES
  -- LANÇAMENTO BASIC
  (
    (SELECT id FROM product_lines WHERE slug = 'lancamento'),
    'LANÇAMENTO BASIC', 'lancamento-basic',
    'Veículos Novos', 'yellow',
    '100% FIPE', '> 2024',
    10.00, 3000.00,
    NULL, NULL,
    NULL, NULL,
    NULL, 'Deságio de leilão: sem cobertura de incêndio',
    'Sem alteração com deságio', 1, true
  ),
  -- LANÇAMENTO PREMIUM
  (
    (SELECT id FROM product_lines WHERE slug = 'lancamento'),
    'LANÇAMENTO PREMIUM', 'lancamento-premium',
    NULL, NULL,
    '100% FIPE', '> 2024',
    10.00, 3000.00,
    NULL, NULL,
    NULL, NULL,
    30.00, 'Deságio de leilão: sem cobertura de incêndio',
    'Sem alteração com deságio', 2, true
  ),
  -- LANÇAMENTO EXCLUSIVE
  (
    (SELECT id FROM product_lines WHERE slug = 'lancamento'),
    'LANÇAMENTO EXCLUSIVE', 'lancamento-exclusive',
    NULL, NULL,
    '100% FIPE', '> 2024',
    10.00, 3000.00,
    NULL, NULL,
    NULL, NULL,
    60.00, 'Deságio de leilão: sem cobertura de incêndio',
    'Sem alteração com deságio', 3, true
  );

-- ======================
-- LINHA ADVANCED (MOTOS)
-- ======================
INSERT INTO public.plans (
  product_line_id, name, slug, badge_text, badge_color,
  coverage_type, min_vehicle_year, 
  cota_passeio_percent, cota_passeio_min,
  cota_desagio_percent, cota_desagio_min,
  cota_app_percent, cota_app_min,
  additional_price, restriction_alert,
  footer_note, display_order, is_active
) VALUES
  -- ADVANCED
  (
    (SELECT id FROM product_lines WHERE slug = 'advanced'),
    'ADVANCED', 'advanced',
    NULL, NULL,
    'Roubo/Furto', '> 2005',
    NULL, NULL,
    NULL, NULL,
    NULL, NULL,
    NULL, NULL,
    'Honda e Yamaha (20 anos)', 1, true
  ),
  -- ADVANCED+
  (
    (SELECT id FROM product_lines WHERE slug = 'advanced'),
    'ADVANCED+', 'advanced-plus',
    'Motos Completo', 'green',
    'Roubo/Furto', '> 2005',
    10.00, 1500.00,
    NULL, NULL,
    NULL, NULL,
    NULL, NULL,
    'Honda e Yamaha (20 anos)', 2, true
  );

-- ======================
-- BENEFÍCIOS - LINHA ESPECIAL
-- ======================

-- ESPECIAL (3 benefícios)
INSERT INTO public.plan_benefits (plan_id, benefit_id, custom_text, custom_value, additional_info, is_highlighted, display_order)
VALUES
  ((SELECT id FROM plans WHERE slug = 'especial'), (SELECT id FROM benefits WHERE slug = 'roubo-furto'), NULL, NULL, NULL, true, 1),
  ((SELECT id FROM plans WHERE slug = 'especial'), (SELECT id FROM benefits WHERE slug = 'assistencia-24h'), 'Assistência 24h 400km', NULL, NULL, false, 2),
  ((SELECT id FROM plans WHERE slug = 'especial'), (SELECT id FROM benefits WHERE slug = 'rastreador'), NULL, NULL, '(obrigatório)', false, 3);

-- ESPECIAL PLUS (8 benefícios)
INSERT INTO public.plan_benefits (plan_id, benefit_id, custom_text, custom_value, additional_info, is_highlighted, display_order)
VALUES
  ((SELECT id FROM plans WHERE slug = 'especial-plus'), (SELECT id FROM benefits WHERE slug = 'roubo-furto'), NULL, NULL, NULL, true, 1),
  ((SELECT id FROM plans WHERE slug = 'especial-plus'), (SELECT id FROM benefits WHERE slug = 'colisao'), NULL, NULL, NULL, true, 2),
  ((SELECT id FROM plans WHERE slug = 'especial-plus'), (SELECT id FROM benefits WHERE slug = 'perda-total'), NULL, NULL, NULL, true, 3),
  ((SELECT id FROM plans WHERE slug = 'especial-plus'), (SELECT id FROM benefits WHERE slug = 'incendio'), NULL, NULL, NULL, true, 4),
  ((SELECT id FROM plans WHERE slug = 'especial-plus'), (SELECT id FROM benefits WHERE slug = 'alagamento'), NULL, NULL, NULL, true, 5),
  ((SELECT id FROM plans WHERE slug = 'especial-plus'), (SELECT id FROM benefits WHERE slug = 'chuva-granizo'), NULL, NULL, NULL, true, 6),
  ((SELECT id FROM plans WHERE slug = 'especial-plus'), (SELECT id FROM benefits WHERE slug = 'assistencia-24h'), 'Assistência 24h 400km', NULL, NULL, false, 7),
  ((SELECT id FROM plans WHERE slug = 'especial-plus'), (SELECT id FROM benefits WHERE slug = 'rastreador'), NULL, NULL, '(acima de R$30mil)', false, 8);

-- ======================
-- BENEFÍCIOS - LINHA LANÇAMENTO
-- ======================

-- LANÇAMENTO BASIC (8 benefícios)
INSERT INTO public.plan_benefits (plan_id, benefit_id, custom_text, custom_value, additional_info, is_highlighted, display_order)
VALUES
  ((SELECT id FROM plans WHERE slug = 'lancamento-basic'), (SELECT id FROM benefits WHERE slug = 'roubo-furto'), NULL, NULL, NULL, true, 1),
  ((SELECT id FROM plans WHERE slug = 'lancamento-basic'), (SELECT id FROM benefits WHERE slug = 'colisao'), NULL, NULL, NULL, true, 2),
  ((SELECT id FROM plans WHERE slug = 'lancamento-basic'), (SELECT id FROM benefits WHERE slug = 'perda-total'), NULL, NULL, NULL, true, 3),
  ((SELECT id FROM plans WHERE slug = 'lancamento-basic'), (SELECT id FROM benefits WHERE slug = 'incendio'), NULL, NULL, NULL, true, 4),
  ((SELECT id FROM plans WHERE slug = 'lancamento-basic'), (SELECT id FROM benefits WHERE slug = 'alagamento'), NULL, NULL, NULL, true, 5),
  ((SELECT id FROM plans WHERE slug = 'lancamento-basic'), (SELECT id FROM benefits WHERE slug = 'chuva-granizo'), NULL, NULL, NULL, true, 6),
  ((SELECT id FROM plans WHERE slug = 'lancamento-basic'), (SELECT id FROM benefits WHERE slug = 'assistencia-24h'), 'Assistência 24h 400km', NULL, NULL, false, 7),
  ((SELECT id FROM plans WHERE slug = 'lancamento-basic'), (SELECT id FROM benefits WHERE slug = 'rastreador'), NULL, NULL, NULL, false, 8);

-- LANÇAMENTO PREMIUM (12 benefícios) = BASIC + 4
INSERT INTO public.plan_benefits (plan_id, benefit_id, custom_text, custom_value, additional_info, is_highlighted, display_order)
VALUES
  ((SELECT id FROM plans WHERE slug = 'lancamento-premium'), (SELECT id FROM benefits WHERE slug = 'roubo-furto'), NULL, NULL, NULL, true, 1),
  ((SELECT id FROM plans WHERE slug = 'lancamento-premium'), (SELECT id FROM benefits WHERE slug = 'colisao'), NULL, NULL, NULL, true, 2),
  ((SELECT id FROM plans WHERE slug = 'lancamento-premium'), (SELECT id FROM benefits WHERE slug = 'perda-total'), NULL, NULL, NULL, true, 3),
  ((SELECT id FROM plans WHERE slug = 'lancamento-premium'), (SELECT id FROM benefits WHERE slug = 'incendio'), NULL, NULL, NULL, true, 4),
  ((SELECT id FROM plans WHERE slug = 'lancamento-premium'), (SELECT id FROM benefits WHERE slug = 'alagamento'), NULL, NULL, NULL, true, 5),
  ((SELECT id FROM plans WHERE slug = 'lancamento-premium'), (SELECT id FROM benefits WHERE slug = 'chuva-granizo'), NULL, NULL, NULL, true, 6),
  ((SELECT id FROM plans WHERE slug = 'lancamento-premium'), (SELECT id FROM benefits WHERE slug = 'assistencia-24h'), 'Assistência 24h 400km', NULL, NULL, false, 7),
  ((SELECT id FROM plans WHERE slug = 'lancamento-premium'), (SELECT id FROM benefits WHERE slug = 'rastreador'), NULL, NULL, NULL, false, 8),
  ((SELECT id FROM plans WHERE slug = 'lancamento-premium'), (SELECT id FROM benefits WHERE slug = 'reboque'), '1000km Reboque', NULL, NULL, false, 9),
  ((SELECT id FROM plans WHERE slug = 'lancamento-premium'), (SELECT id FROM benefits WHERE slug = 'danos-terceiros'), 'Danos Terceiros R$40mil', 40000, NULL, false, 10),
  ((SELECT id FROM plans WHERE slug = 'lancamento-premium'), (SELECT id FROM benefits WHERE slug = 'vidros-farois'), NULL, NULL, '(após 120 dias)', false, 11),
  ((SELECT id FROM plans WHERE slug = 'lancamento-premium'), (SELECT id FROM benefits WHERE slug = 'reboque-excedente'), NULL, NULL, '(1x a cada 6 meses)', false, 12);

-- LANÇAMENTO EXCLUSIVE (14 benefícios) = PREMIUM + 2
INSERT INTO public.plan_benefits (plan_id, benefit_id, custom_text, custom_value, additional_info, is_highlighted, display_order)
VALUES
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'roubo-furto'), NULL, NULL, NULL, true, 1),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'colisao'), NULL, NULL, NULL, true, 2),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'perda-total'), NULL, NULL, NULL, true, 3),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'incendio'), NULL, NULL, NULL, true, 4),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'alagamento'), NULL, NULL, NULL, true, 5),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'chuva-granizo'), NULL, NULL, NULL, true, 6),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'assistencia-24h'), 'Assistência 24h 400km', NULL, NULL, false, 7),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'rastreador'), NULL, NULL, NULL, false, 8),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'reboque'), '1000km Reboque', NULL, NULL, false, 9),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'danos-terceiros'), 'Danos Terceiros R$40mil', 40000, NULL, false, 10),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'vidros-farois'), NULL, NULL, '(após 120 dias)', false, 11),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'reboque-excedente'), NULL, NULL, '(1x a cada 6 meses)', false, 12),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'kit-gas'), NULL, NULL, NULL, false, 13),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'fipe-app'), '100% FIPE APP', NULL, NULL, false, 14),
  ((SELECT id FROM plans WHERE slug = 'lancamento-exclusive'), (SELECT id FROM benefits WHERE slug = 'carro-reserva'), NULL, NULL, '(somente em colisão)', false, 15);

-- ======================
-- BENEFÍCIOS - LINHA ADVANCED (MOTOS)
-- ======================

-- ADVANCED (3 benefícios)
INSERT INTO public.plan_benefits (plan_id, benefit_id, custom_text, custom_value, additional_info, is_highlighted, display_order)
VALUES
  ((SELECT id FROM plans WHERE slug = 'advanced'), (SELECT id FROM benefits WHERE slug = 'roubo-furto'), NULL, NULL, NULL, true, 1),
  ((SELECT id FROM plans WHERE slug = 'advanced'), (SELECT id FROM benefits WHERE slug = 'assistencia-24h'), 'Assistência 24h 400km', NULL, NULL, false, 2),
  ((SELECT id FROM plans WHERE slug = 'advanced'), (SELECT id FROM benefits WHERE slug = 'rastreador'), NULL, NULL, NULL, false, 3);

-- ADVANCED+ (5 benefícios)
INSERT INTO public.plan_benefits (plan_id, benefit_id, custom_text, custom_value, additional_info, is_highlighted, display_order)
VALUES
  ((SELECT id FROM plans WHERE slug = 'advanced-plus'), (SELECT id FROM benefits WHERE slug = 'roubo-furto'), NULL, NULL, NULL, true, 1),
  ((SELECT id FROM plans WHERE slug = 'advanced-plus'), (SELECT id FROM benefits WHERE slug = 'assistencia-24h'), 'Assistência 24h 600km', NULL, NULL, false, 2),
  ((SELECT id FROM plans WHERE slug = 'advanced-plus'), (SELECT id FROM benefits WHERE slug = 'rastreador'), NULL, NULL, '(acima de R$9mil)', false, 3),
  ((SELECT id FROM plans WHERE slug = 'advanced-plus'), (SELECT id FROM benefits WHERE slug = 'colisao'), NULL, NULL, '(cota 10%)', true, 4),
  ((SELECT id FROM plans WHERE slug = 'advanced-plus'), (SELECT id FROM benefits WHERE slug = 'danos-terceiros'), 'Danos Terceiros R$10mil', 10000, '(participação R$750)', false, 5);
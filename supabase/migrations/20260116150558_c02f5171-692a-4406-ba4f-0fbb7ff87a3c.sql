-- =====================================================
-- SEED DATA: PLANOS LINHA SELECT E BENEFÍCIOS
-- =====================================================

-- 1. Inserir planos da Linha Select
INSERT INTO public.plans (
  product_line_id, name, slug, badge_text, badge_color,
  coverage_type, min_vehicle_year, 
  cota_passeio_percent, cota_passeio_min,
  cota_desagio_percent, cota_desagio_min,
  cota_app_percent, cota_app_min,
  additional_price, restriction_alert, display_order, is_active
) VALUES
  -- SELECT BASIC
  (
    (SELECT id FROM product_lines WHERE slug = 'select'),
    'SELECT BASIC', 'select-basic',
    'Mais Popular', 'yellow',
    '100% FIPE', '> 2005',
    6.00, 1200.00,
    8.00, 2000.00,
    NULL, NULL,
    NULL, 'Deságio de leilão: sem cobertura de incêndio',
    1, true
  ),
  -- SELECT PREMIUM
  (
    (SELECT id FROM product_lines WHERE slug = 'select'),
    'SELECT PREMIUM', 'select-premium',
    NULL, NULL,
    '100% FIPE', '> 2005',
    6.00, 1200.00,
    8.00, 2000.00,
    NULL, NULL,
    30.00, 'Deságio de leilão: sem cobertura de incêndio',
    2, true
  ),
  -- SELECT EXCLUSIVE
  (
    (SELECT id FROM product_lines WHERE slug = 'select'),
    'SELECT EXCLUSIVE', 'select-exclusive',
    'Completo', 'green',
    '100% FIPE', '> 2005',
    6.00, 1200.00,
    8.00, 2000.00,
    8.00, 3000.00,
    60.00, 'Deságio de leilão: sem cobertura de incêndio',
    3, true
  ),
  -- SELECT ONE
  (
    (SELECT id FROM product_lines WHERE slug = 'select'),
    'SELECT ONE', 'select-one',
    'Tudo Incluído', 'green',
    '100% FIPE', '> 2005',
    6.00, 1200.00,
    8.00, 2000.00,
    8.00, 3000.00,
    NULL, 'Deságio de leilão: sem cobertura de incêndio',
    4, true
  );

-- 2. Inserir benefícios do SELECT BASIC
INSERT INTO public.plan_benefits (plan_id, benefit_id, custom_text, custom_value, additional_info, is_highlighted, display_order)
VALUES
  ((SELECT id FROM plans WHERE slug = 'select-basic'), (SELECT id FROM benefits WHERE slug = 'roubo-furto'), NULL, NULL, NULL, true, 1),
  ((SELECT id FROM plans WHERE slug = 'select-basic'), (SELECT id FROM benefits WHERE slug = 'colisao'), NULL, NULL, NULL, true, 2),
  ((SELECT id FROM plans WHERE slug = 'select-basic'), (SELECT id FROM benefits WHERE slug = 'perda-total'), NULL, NULL, NULL, true, 3),
  ((SELECT id FROM plans WHERE slug = 'select-basic'), (SELECT id FROM benefits WHERE slug = 'incendio'), NULL, NULL, NULL, true, 4),
  ((SELECT id FROM plans WHERE slug = 'select-basic'), (SELECT id FROM benefits WHERE slug = 'alagamento'), NULL, NULL, NULL, false, 5),
  ((SELECT id FROM plans WHERE slug = 'select-basic'), (SELECT id FROM benefits WHERE slug = 'chuva-granizo'), NULL, NULL, NULL, false, 6),
  ((SELECT id FROM plans WHERE slug = 'select-basic'), (SELECT id FROM benefits WHERE slug = 'assistencia-24h'), 'Assistência 24h 400km', NULL, NULL, false, 7),
  ((SELECT id FROM plans WHERE slug = 'select-basic'), (SELECT id FROM benefits WHERE slug = 'rastreador'), NULL, NULL, '(acima de R$30mil)', false, 8);

-- 3. Inserir benefícios do SELECT PREMIUM
INSERT INTO public.plan_benefits (plan_id, benefit_id, custom_text, custom_value, additional_info, is_highlighted, display_order)
VALUES
  ((SELECT id FROM plans WHERE slug = 'select-premium'), (SELECT id FROM benefits WHERE slug = 'roubo-furto'), NULL, NULL, NULL, true, 1),
  ((SELECT id FROM plans WHERE slug = 'select-premium'), (SELECT id FROM benefits WHERE slug = 'colisao'), NULL, NULL, NULL, true, 2),
  ((SELECT id FROM plans WHERE slug = 'select-premium'), (SELECT id FROM benefits WHERE slug = 'perda-total'), NULL, NULL, NULL, true, 3),
  ((SELECT id FROM plans WHERE slug = 'select-premium'), (SELECT id FROM benefits WHERE slug = 'incendio'), NULL, NULL, NULL, true, 4),
  ((SELECT id FROM plans WHERE slug = 'select-premium'), (SELECT id FROM benefits WHERE slug = 'alagamento'), NULL, NULL, NULL, false, 5),
  ((SELECT id FROM plans WHERE slug = 'select-premium'), (SELECT id FROM benefits WHERE slug = 'chuva-granizo'), NULL, NULL, NULL, false, 6),
  ((SELECT id FROM plans WHERE slug = 'select-premium'), (SELECT id FROM benefits WHERE slug = 'assistencia-24h'), 'Assistência 24h 400km', NULL, NULL, false, 7),
  ((SELECT id FROM plans WHERE slug = 'select-premium'), (SELECT id FROM benefits WHERE slug = 'rastreador'), NULL, NULL, '(acima de R$30mil)', false, 8),
  ((SELECT id FROM plans WHERE slug = 'select-premium'), (SELECT id FROM benefits WHERE slug = 'reboque'), '1000km Reboque', NULL, NULL, false, 9),
  ((SELECT id FROM plans WHERE slug = 'select-premium'), (SELECT id FROM benefits WHERE slug = 'danos-terceiros'), NULL, 'R$40mil', NULL, false, 10),
  ((SELECT id FROM plans WHERE slug = 'select-premium'), (SELECT id FROM benefits WHERE slug = 'vidros-farois'), NULL, NULL, '(após 120 dias)', false, 11),
  ((SELECT id FROM plans WHERE slug = 'select-premium'), (SELECT id FROM benefits WHERE slug = 'reboque-excedente'), NULL, NULL, '(1x a cada 6 meses)', false, 12);

-- 4. Inserir benefícios do SELECT EXCLUSIVE
INSERT INTO public.plan_benefits (plan_id, benefit_id, custom_text, custom_value, additional_info, is_highlighted, display_order)
VALUES
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'roubo-furto'), NULL, NULL, NULL, true, 1),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'colisao'), NULL, NULL, NULL, true, 2),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'perda-total'), NULL, NULL, NULL, true, 3),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'incendio'), NULL, NULL, NULL, true, 4),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'alagamento'), NULL, NULL, NULL, false, 5),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'chuva-granizo'), NULL, NULL, NULL, false, 6),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'assistencia-24h'), 'Assistência 24h 400km', NULL, NULL, false, 7),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'rastreador'), NULL, NULL, '(acima de R$30mil)', false, 8),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'reboque'), '1000km Reboque', NULL, NULL, false, 9),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'danos-terceiros'), NULL, 'R$40mil', NULL, false, 10),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'vidros-farois'), NULL, NULL, '(após 120 dias)', false, 11),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'reboque-excedente'), NULL, NULL, '(1x a cada 6 meses)', false, 12),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'kit-gas'), NULL, NULL, NULL, false, 13),
  ((SELECT id FROM plans WHERE slug = 'select-exclusive'), (SELECT id FROM benefits WHERE slug = 'fipe-app'), '100% FIPE APP + Carro Reserva', NULL, '(somente em colisão)', false, 14);

-- 5. Inserir benefícios do SELECT ONE
INSERT INTO public.plan_benefits (plan_id, benefit_id, custom_text, custom_value, additional_info, is_highlighted, display_order)
VALUES
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'roubo-furto'), NULL, NULL, NULL, true, 1),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'colisao'), NULL, NULL, NULL, true, 2),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'perda-total'), NULL, NULL, NULL, true, 3),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'incendio'), NULL, NULL, NULL, true, 4),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'alagamento'), NULL, NULL, NULL, false, 5),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'chuva-granizo'), NULL, NULL, NULL, false, 6),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'assistencia-24h'), 'Assistência 24h 400km', NULL, NULL, false, 7),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'rastreador'), NULL, NULL, '(acima de R$30mil)', false, 8),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'reboque'), '1000km Reboque', NULL, NULL, false, 9),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'danos-terceiros'), NULL, 'R$100mil', NULL, false, 10),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'vidros-farois'), NULL, NULL, '(após 120 dias)', false, 11),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'reboque-excedente'), NULL, NULL, '(1x a cada 6 meses)', false, 12),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'kit-gas'), NULL, NULL, NULL, false, 13),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'fipe-app'), '100% FIPE APP + Carro Reserva', NULL, '(somente em colisão)', false, 14),
  ((SELECT id FROM plans WHERE slug = 'select-one'), (SELECT id FROM benefits WHERE slug = 'clube-gas'), 'Clube Gás (10% desconto)', NULL, NULL, false, 15);
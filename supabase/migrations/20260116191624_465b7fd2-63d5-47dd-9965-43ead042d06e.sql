-- =============================================
-- CRIAR NOVOS PLANOS DE APLICATIVO
-- NÃO modifica nenhum plano existente
-- =============================================

-- 1. SELECT EXCLUSIVE APLICATIVO
INSERT INTO plans (
  name, slug, product_line_id, badge_text, badge_color,
  coverage_type, min_vehicle_year,
  cota_passeio_percent, cota_passeio_min,
  cota_desagio_percent, cota_desagio_min,
  cota_app_percent, cota_app_min,
  additional_price, restriction_alert, is_active, display_order
) VALUES (
  'SELECT EXCLUSIVE APLICATIVO',
  'select-exclusive-aplicativo',
  '84a6db47-0d18-433e-a2f4-1576012faf9a',
  'Completo',
  'green',
  '100% FIPE',
  '> 2005',
  8, 1200,
  8, 2000,
  8, 3000,
  60,
  'Deságio de leilão: sem cobertura de incêndio',
  true,
  5
);

-- 2. SELECT ONE APLICATIVO
INSERT INTO plans (
  name, slug, product_line_id, badge_text, badge_color,
  coverage_type, min_vehicle_year,
  cota_passeio_percent, cota_passeio_min,
  cota_desagio_percent, cota_desagio_min,
  cota_app_percent, cota_app_min,
  additional_price, restriction_alert, is_active, display_order
) VALUES (
  'SELECT ONE APLICATIVO',
  'select-one-aplicativo',
  '84a6db47-0d18-433e-a2f4-1576012faf9a',
  'Tudo Incluído',
  'green',
  '100% FIPE',
  '> 2005',
  8, 1200,
  8, 2000,
  8, 3000,
  NULL,
  'Deságio de leilão: sem cobertura de incêndio',
  true,
  6
);

-- 3. LANÇAMENTO EXCLUSIVE APLICATIVO
INSERT INTO plans (
  name, slug, product_line_id, badge_text, badge_color,
  coverage_type, min_vehicle_year,
  cota_passeio_percent, cota_passeio_min,
  cota_desagio_percent, cota_desagio_min,
  cota_app_percent, cota_app_min,
  additional_price, restriction_alert, footer_note, is_active, display_order
) VALUES (
  'LANÇAMENTO EXCLUSIVE APLICATIVO',
  'lancamento-exclusive-aplicativo',
  '7b74ee3c-16b8-444c-904d-7aa680d41531',
  NULL,
  NULL,
  '100% FIPE',
  '> 2024',
  8, 3000,
  NULL, NULL,
  NULL, NULL,
  60,
  'Deságio de leilão: sem cobertura de incêndio',
  'Sem alteração com deságio',
  true,
  4
);

-- =============================================
-- COPIAR BENEFÍCIOS PARA OS NOVOS PLANOS
-- =============================================

-- Copiar benefícios do SELECT EXCLUSIVE para SELECT EXCLUSIVE APLICATIVO
INSERT INTO plan_benefits (plan_id, benefit_id, display_order, is_highlighted, custom_text)
SELECT 
  (SELECT id FROM plans WHERE slug = 'select-exclusive-aplicativo'),
  benefit_id,
  display_order,
  is_highlighted,
  custom_text
FROM plan_benefits
WHERE plan_id = 'ba5f340e-7b0e-448a-934b-e44692f4efad';

-- Copiar benefícios do SELECT ONE para SELECT ONE APLICATIVO
INSERT INTO plan_benefits (plan_id, benefit_id, display_order, is_highlighted, custom_text)
SELECT 
  (SELECT id FROM plans WHERE slug = 'select-one-aplicativo'),
  benefit_id,
  display_order,
  is_highlighted,
  custom_text
FROM plan_benefits
WHERE plan_id = 'a1f1b059-9fc8-43b6-b8b3-e5443ae1ef42';

-- Copiar benefícios do LANÇAMENTO EXCLUSIVE para LANÇAMENTO EXCLUSIVE APLICATIVO
INSERT INTO plan_benefits (plan_id, benefit_id, display_order, is_highlighted, custom_text)
SELECT 
  (SELECT id FROM plans WHERE slug = 'lancamento-exclusive-aplicativo'),
  benefit_id,
  display_order,
  is_highlighted,
  custom_text
FROM plan_benefits
WHERE plan_id = 'd09160ad-4157-4042-9926-06def549e214';
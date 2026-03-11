-- Coluna dinâmica de desconto percentual (qualquer plano pode ter desconto)
ALTER TABLE planos ADD COLUMN IF NOT EXISTS desconto_percentual NUMERIC DEFAULT 0;

-- Inserir plano promocional "SELECT ONE 5% PROMO" baseado no select-one existente
INSERT INTO planos (
  codigo, nome, slug, product_line_id, tipo_uso, linha, categoria,
  valor_adesao, adicional_mensal, desconto_percentual,
  badge_text, badge_color, coverage_type, ano_minimo,
  coberturas, destaque, ativo, ordem,
  fipe_minima, fipe_maxima,
  cota_participacao, cota_minima, cota_desagio, cota_minima_desagio,
  cota_app_percent, cota_app_min,
  restriction_alert, footer_note
)
SELECT
  'select-one-promo-5',
  'SELECT ONE 5% PROMO',
  'select-one-promo-5',
  product_line_id,
  tipo_uso,
  linha,
  categoria,
  valor_adesao,
  adicional_mensal,
  5,
  '5% OFF',
  'green',
  coverage_type,
  ano_minimo,
  coberturas,
  true,
  true,
  ordem + 1,
  fipe_minima,
  fipe_maxima,
  cota_participacao,
  cota_minima,
  cota_desagio,
  cota_minima_desagio,
  cota_app_percent,
  cota_app_min,
  restriction_alert,
  footer_note
FROM planos
WHERE codigo = 'select-one'
LIMIT 1;

-- Vincular ao mesmo pricing do select-one
INSERT INTO plano_preco_map (plano_id, linha_slug, tipo_uso)
SELECT p.id, 'select-one', m.tipo_uso
FROM planos p
CROSS JOIN (
  SELECT tipo_uso FROM plano_preco_map
  WHERE plano_id = (SELECT id FROM planos WHERE codigo = 'select-one' LIMIT 1)
  LIMIT 1
) m
WHERE p.codigo = 'select-one-promo-5';

-- Copiar benefícios do plano original
INSERT INTO planos_beneficios (plano_id, benefit_id, beneficio, custom_text, custom_value, additional_info, is_highlighted, display_order, incluso)
SELECT
  (SELECT id FROM planos WHERE codigo = 'select-one-promo-5'),
  benefit_id, beneficio, custom_text, custom_value, additional_info, is_highlighted, display_order, incluso
FROM planos_beneficios
WHERE plano_id = (SELECT id FROM planos WHERE codigo = 'select-one' LIMIT 1);
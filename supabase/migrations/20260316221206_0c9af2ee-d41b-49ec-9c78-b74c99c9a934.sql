
-- 1. Fix eletricos plan defaults
UPDATE planos 
SET cota_participacao = 10, cota_minima = 0, updated_at = NOW() 
WHERE slug = 'eletricos' AND (cota_participacao IS NULL OR cota_minima IS NULL);

-- 2. Populate planos_cotas_categoria with V12 data
-- Select plans + Especial: passeio, aplicativo, desagio, diesel
INSERT INTO planos_cotas_categoria (plano_id, categoria_veiculo, cota_percentual, cota_minima_valor)
SELECT p.id, cat.categoria_veiculo, cat.cota_percentual, cat.cota_minima_valor
FROM planos p
CROSS JOIN (VALUES 
  ('passeio',    6.0,  1200.00),
  ('aplicativo', 8.0,  3000.00),
  ('desagio',    8.0,  2000.00),
  ('diesel',     6.0,  2500.00)
) AS cat(categoria_veiculo, cota_percentual, cota_minima_valor)
WHERE p.slug IN ('select-basic','select-premium','select-exclusive','select-one','select-one-promo-5','especial')
  AND p.ativo = true
ON CONFLICT (plano_id, categoria_veiculo) DO UPDATE
  SET cota_percentual = EXCLUDED.cota_percentual,
      cota_minima_valor = EXCLUDED.cota_minima_valor,
      updated_at = NOW();

-- Advanced plans: moto
INSERT INTO planos_cotas_categoria (plano_id, categoria_veiculo, cota_percentual, cota_minima_valor)
SELECT p.id, 'moto', 10.0, 1500.00
FROM planos p
WHERE p.slug IN ('advanced','advanced-plus')
  AND p.ativo = true
ON CONFLICT (plano_id, categoria_veiculo) DO UPDATE
  SET cota_percentual = EXCLUDED.cota_percentual,
      cota_minima_valor = EXCLUDED.cota_minima_valor,
      updated_at = NOW();

-- Especial Plus
INSERT INTO planos_cotas_categoria (plano_id, categoria_veiculo, cota_percentual, cota_minima_valor)
SELECT p.id, 'especial_plus', 10.0, 3000.00
FROM planos p
WHERE p.slug = 'especial-plus'
  AND p.ativo = true
ON CONFLICT (plano_id, categoria_veiculo) DO UPDATE
  SET cota_percentual = EXCLUDED.cota_percentual,
      cota_minima_valor = EXCLUDED.cota_minima_valor,
      updated_at = NOW();

-- Lançamento plans
INSERT INTO planos_cotas_categoria (plano_id, categoria_veiculo, cota_percentual, cota_minima_valor)
SELECT p.id, 'lancamento', 10.0, 3000.00
FROM planos p
WHERE p.slug IN ('lancamento-basic','lancamento-premium','lancamento-exclusive')
  AND p.ativo = true
ON CONFLICT (plano_id, categoria_veiculo) DO UPDATE
  SET cota_percentual = EXCLUDED.cota_percentual,
      cota_minima_valor = EXCLUDED.cota_minima_valor,
      updated_at = NOW();

-- Elétricos
INSERT INTO planos_cotas_categoria (plano_id, categoria_veiculo, cota_percentual, cota_minima_valor)
SELECT p.id, 'eletrico', 10.0, 0.00
FROM planos p
WHERE p.slug = 'eletricos'
  AND p.ativo = true
ON CONFLICT (plano_id, categoria_veiculo) DO UPDATE
  SET cota_percentual = EXCLUDED.cota_percentual,
      cota_minima_valor = EXCLUDED.cota_minima_valor,
      updated_at = NOW();

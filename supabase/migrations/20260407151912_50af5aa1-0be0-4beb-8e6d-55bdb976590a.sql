
WITH new_plans(nome, codigo, ordem) AS (VALUES
  ('Lançamento Basic - Deságio 75%',           'lancamento-basic-desagio-75',            1),
  ('Lançamento Basic - Deságio 70%',           'lancamento-basic-desagio-70',            2),
  ('Lançamento Basic Diesel',                  'lancamento-basic-diesel',                3),
  ('Lançamento Basic Diesel - Deságio 75%',    'lancamento-basic-diesel-desagio-75',     4),
  ('Lançamento Basic Diesel - Deságio 70%',    'lancamento-basic-diesel-desagio-70',     5),
  ('Lançamento Premium - Deságio 75%',         'lancamento-premium-desagio-75',          7),
  ('Lançamento Premium - Deságio 70%',         'lancamento-premium-desagio-70',          8),
  ('Lançamento Premium Diesel',                'lancamento-premium-diesel',              9),
  ('Lançamento Premium Diesel - Deságio 75%',  'lancamento-premium-diesel-desagio-75',  10),
  ('Lançamento Premium Diesel - Deságio 70%',  'lancamento-premium-diesel-desagio-70',  11),
  ('Lançamento Exclusive - Deságio 70%',       'lancamento-exclusive-desagio-70',       13),
  ('Lançamento Exclusive - Deságio 75%',       'lancamento-exclusive-desagio-75',       14),
  ('Lançamento Exclusive Diesel',              'lancamento-exclusive-diesel',           15),
  ('Lançamento Exclusive Diesel - Deságio 75%','lancamento-exclusive-diesel-desagio-75',16),
  ('Lançamento Exclusive Diesel - Deságio 70%','lancamento-exclusive-diesel-desagio-70',17)
),
inserted_plans AS (
  INSERT INTO planos (
    nome, codigo, slug, product_line_id, cobertura_fipe, ano_minimo, valor_adesao,
    destaque, ativo, ordem, tipo_uso, fipe_minima, fipe_maxima,
    visivel_gestao, visivel_landing, disponivel_agente, desconto_percentual, cota_terceiros_isento
  )
  SELECT
    np.nome, np.codigo, np.codigo,
    '4ed27b6d-ded3-40f6-b4b7-2c1f56155d16',
    100, 2005, 0.00, false, true, np.ordem, 'passeio',
    50000.00, 999999999.00, true, false, false, 0, false
  FROM new_plans np
  RETURNING id, nome, codigo, ordem
),
coberturas_insert AS (
  INSERT INTO planos_coberturas (plano_id, cobertura_id)
  SELECT ip.id, c.cob_id
  FROM inserted_plans ip
  CROSS JOIN (VALUES
    ('4fb7f25e-6e8d-4eaa-a233-440b93d10432'::uuid),
    ('e5bd79a0-16bd-49a1-b59f-1fb5c1977837'::uuid),
    ('128c0c26-a8b0-4f95-a071-ed5977050dec'::uuid),
    ('03bdb29e-b7be-4200-b92d-ac287821db24'::uuid),
    ('75d3215d-4b1e-4851-9c23-74a7422c12dd'::uuid),
    ('ba283787-a360-4721-869a-de02762e7936'::uuid),
    ('a1a26d45-353a-4031-a6d6-35f232d7df3c'::uuid),
    ('c5eee049-64a5-44a3-bb01-dd9ac9458d67'::uuid),
    ('90be6bc1-c903-458b-a275-fd64aada748d'::uuid)
  ) AS c(cob_id)
),
-- Basic (non-diesel): Assistência 400km + Rastreador
b_basic AS (
  INSERT INTO planos_beneficios (plano_id, benefit_id, beneficio)
  SELECT ip.id, b.id, b.name FROM inserted_plans ip
  CROSS JOIN benefits b
  WHERE ip.codigo LIKE 'lancamento-basic-%' AND ip.codigo NOT LIKE '%diesel%'
    AND b.id IN ('be1fa928-b1fe-4bbb-a402-ec0604bc9e8e','9477eca1-9fbd-4ec8-8a7a-f795d941f2bb')
),
-- Basic Diesel
b_basic_d AS (
  INSERT INTO planos_beneficios (plano_id, benefit_id, beneficio)
  SELECT ip.id, b.id, b.name FROM inserted_plans ip
  CROSS JOIN benefits b
  WHERE ip.codigo LIKE 'lancamento-basic-diesel%'
    AND b.id IN ('0cbf0a34-3a1f-4aa7-a4ef-cf4789190e11','9477eca1-9fbd-4ec8-8a7a-f795d941f2bb')
),
-- Premium (non-diesel)
b_prem AS (
  INSERT INTO planos_beneficios (plano_id, benefit_id, beneficio)
  SELECT ip.id, b.id, b.name FROM inserted_plans ip
  CROSS JOIN benefits b
  WHERE ip.codigo LIKE 'lancamento-premium-%' AND ip.codigo NOT LIKE '%diesel%'
    AND b.id IN ('ce0c5167-991c-4e0a-b5c2-21b23bc91807','06620892-cd6a-4658-98e4-bb5cbe0378eb','9477eca1-9fbd-4ec8-8a7a-f795d941f2bb','93256596-4834-4fb0-a792-c57b8aa7d9ea','77e01baf-7ae7-4258-98b7-736a7ab15e78')
),
-- Premium Diesel
b_prem_d AS (
  INSERT INTO planos_beneficios (plano_id, benefit_id, beneficio)
  SELECT ip.id, b.id, b.name FROM inserted_plans ip
  CROSS JOIN benefits b
  WHERE ip.codigo LIKE 'lancamento-premium-diesel%'
    AND b.id IN ('788e3bd9-3d6e-49b4-ada9-89217cf5c4b0','06620892-cd6a-4658-98e4-bb5cbe0378eb','9477eca1-9fbd-4ec8-8a7a-f795d941f2bb','93256596-4834-4fb0-a792-c57b8aa7d9ea','77e01baf-7ae7-4258-98b7-736a7ab15e78')
),
-- Exclusive (non-diesel)
b_excl AS (
  INSERT INTO planos_beneficios (plano_id, benefit_id, beneficio)
  SELECT ip.id, b.id, b.name FROM inserted_plans ip
  CROSS JOIN benefits b
  WHERE ip.codigo LIKE 'lancamento-exclusive-%' AND ip.codigo NOT LIKE '%diesel%'
    AND b.id IN ('ce0c5167-991c-4e0a-b5c2-21b23bc91807','4b8c845a-9d80-4226-ace6-ce1df1f9e7c4','06620892-cd6a-4658-98e4-bb5cbe0378eb','5d89c8ef-7801-41ac-b427-50e386aa7ff8','9477eca1-9fbd-4ec8-8a7a-f795d941f2bb','93256596-4834-4fb0-a792-c57b8aa7d9ea','77e01baf-7ae7-4258-98b7-736a7ab15e78')
),
-- Exclusive Diesel
b_excl_d AS (
  INSERT INTO planos_beneficios (plano_id, benefit_id, beneficio)
  SELECT ip.id, b.id, b.name FROM inserted_plans ip
  CROSS JOIN benefits b
  WHERE ip.codigo LIKE 'lancamento-exclusive-diesel%'
    AND b.id IN ('788e3bd9-3d6e-49b4-ada9-89217cf5c4b0','4b8c845a-9d80-4226-ace6-ce1df1f9e7c4','06620892-cd6a-4658-98e4-bb5cbe0378eb','5d89c8ef-7801-41ac-b427-50e386aa7ff8','9477eca1-9fbd-4ec8-8a7a-f795d941f2bb','93256596-4834-4fb0-a792-c57b8aa7d9ea','77e01baf-7ae7-4258-98b7-736a7ab15e78')
)
SELECT 'OK: 15 planos Lançamento criados com coberturas e benefícios' AS resultado;

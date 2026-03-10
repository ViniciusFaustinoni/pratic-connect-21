
INSERT INTO planos_coberturas 
  (plano_id, cobertura_id, percentual_cobertura, valor_limite, 
   carencia_dias, franquia_valor, obrigatoria)

-- ESPECIAL
SELECT p.id, c.id,
  CASE c.codigo WHEN 'COB-ROU' THEN 100 ELSE NULL END::numeric,
  CASE c.codigo WHEN 'COB-ASS' THEN 400 ELSE NULL END::numeric,
  c.carencia_dias, NULL::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'ESPECIAL'
  AND c.codigo IN ('COB-ROU','COB-ASS','COB-RAS')

UNION ALL

-- ESPECIAL PLUS
SELECT p.id, c.id,
  CASE c.codigo WHEN 'COB-ASS' THEN NULL WHEN 'COB-RAS' THEN NULL ELSE 80 END::numeric,
  CASE c.codigo WHEN 'COB-ASS' THEN 400 ELSE NULL END::numeric,
  c.carencia_dias, NULL::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'ESPECIAL PLUS'
  AND c.codigo IN ('COB-COL','COB-ROU','COB-INC','COB-ALA','COB-GRA','COB-PT','COB-ASS','COB-RAS')

UNION ALL

-- ADVANCED
SELECT p.id, c.id,
  CASE c.codigo WHEN 'COB-ROU' THEN 100 ELSE NULL END::numeric,
  CASE c.codigo WHEN 'COB-ASS' THEN 400 ELSE NULL END::numeric,
  c.carencia_dias, NULL::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'ADVANCED'
  AND c.codigo IN ('COB-ROU','COB-ASS','COB-RAS')

UNION ALL

-- ADVANCED+
SELECT p.id, c.id,
  CASE c.codigo WHEN 'COB-ROU' THEN 100 WHEN 'COB-COL' THEN 100 ELSE NULL END::numeric,
  CASE c.codigo WHEN 'COB-TER' THEN 10000 WHEN 'COB-ASS' THEN 600 ELSE NULL END::numeric,
  c.carencia_dias,
  CASE c.codigo WHEN 'COB-TER' THEN 750 ELSE NULL END::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'ADVANCED+'
  AND c.codigo IN ('COB-ROU','COB-COL','COB-TER','COB-ASS','COB-RAS')

UNION ALL

-- ELÉTRICOS
SELECT p.id, c.id,
  CASE c.codigo WHEN 'COB-TER' THEN NULL WHEN 'COB-ASS' THEN NULL WHEN 'COB-RAS' THEN NULL WHEN 'COB-RES' THEN NULL ELSE 100 END::numeric,
  CASE c.codigo WHEN 'COB-TER' THEN 40000 WHEN 'COB-ASS' THEN 1000 WHEN 'COB-RES' THEN 30 ELSE NULL END::numeric,
  c.carencia_dias, NULL::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'ELÉTRICOS'
  AND c.codigo IN ('COB-COL','COB-ROU','COB-INC','COB-ALA','COB-GRA','COB-PT','COB-TER','COB-ASS','COB-RAS','COB-RES')

ON CONFLICT DO NOTHING;

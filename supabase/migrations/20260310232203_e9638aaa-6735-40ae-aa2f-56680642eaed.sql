
INSERT INTO planos_coberturas 
  (plano_id, cobertura_id, percentual_cobertura, valor_limite, 
   carencia_dias, franquia_valor, obrigatoria)

-- SELECT EXCLUSIVE
SELECT p.id, c.id,
  CASE c.codigo
    WHEN 'COB-TER' THEN NULL WHEN 'COB-ASS' THEN NULL
    WHEN 'COB-RAS' THEN NULL WHEN 'COB-RES' THEN NULL
    ELSE 100
  END::numeric,
  CASE c.codigo
    WHEN 'COB-TER' THEN 40000 WHEN 'COB-ASS' THEN 1000
    WHEN 'COB-RES' THEN 30 ELSE NULL
  END::numeric,
  c.carencia_dias, NULL::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'SELECT EXCLUSIVE'
  AND c.codigo IN ('COB-COL','COB-ROU','COB-INC','COB-ALA','COB-GRA','COB-PT','COB-TER','COB-VID','COB-ASS','COB-RAS','COB-RES')

UNION ALL

-- SELECT EXCLUSIVE APLICATIVO
SELECT p.id, c.id,
  CASE c.codigo
    WHEN 'COB-TER' THEN NULL WHEN 'COB-ASS' THEN NULL
    WHEN 'COB-RAS' THEN NULL WHEN 'COB-RES' THEN NULL
    ELSE 100
  END::numeric,
  CASE c.codigo
    WHEN 'COB-TER' THEN 40000 WHEN 'COB-ASS' THEN 1000
    WHEN 'COB-RES' THEN 30 ELSE NULL
  END::numeric,
  c.carencia_dias, NULL::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'SELECT EXCLUSIVE APLICATIVO'
  AND c.codigo IN ('COB-COL','COB-ROU','COB-INC','COB-ALA','COB-GRA','COB-PT','COB-TER','COB-VID','COB-ASS','COB-RAS','COB-RES')

UNION ALL

-- SELECT ONE
SELECT p.id, c.id,
  CASE c.codigo
    WHEN 'COB-TER' THEN NULL WHEN 'COB-ASS' THEN NULL
    WHEN 'COB-RAS' THEN NULL WHEN 'COB-RES' THEN NULL
    ELSE 100
  END::numeric,
  CASE c.codigo
    WHEN 'COB-TER' THEN 100000 WHEN 'COB-ASS' THEN 1000
    WHEN 'COB-RES' THEN 2200 ELSE NULL
  END::numeric,
  c.carencia_dias, NULL::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'SELECT ONE'
  AND c.codigo IN ('COB-COL','COB-ROU','COB-INC','COB-ALA','COB-GRA','COB-PT','COB-TER','COB-VID','COB-ASS','COB-RAS','COB-RES')

UNION ALL

-- SELECT ONE APLICATIVO
SELECT p.id, c.id,
  CASE c.codigo
    WHEN 'COB-TER' THEN NULL WHEN 'COB-ASS' THEN NULL
    WHEN 'COB-RAS' THEN NULL WHEN 'COB-RES' THEN NULL
    ELSE 100
  END::numeric,
  CASE c.codigo
    WHEN 'COB-TER' THEN 100000 WHEN 'COB-ASS' THEN 1000
    WHEN 'COB-RES' THEN 2200 ELSE NULL
  END::numeric,
  c.carencia_dias, NULL::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'SELECT ONE APLICATIVO'
  AND c.codigo IN ('COB-COL','COB-ROU','COB-INC','COB-ALA','COB-GRA','COB-PT','COB-TER','COB-VID','COB-ASS','COB-RAS','COB-RES')

ON CONFLICT DO NOTHING;

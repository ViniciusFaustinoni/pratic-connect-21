
INSERT INTO planos_coberturas 
  (plano_id, cobertura_id, percentual_cobertura, valor_limite, 
   carencia_dias, franquia_valor, obrigatoria)

SELECT p.id, c.id,
  CASE c.codigo WHEN 'COB-ASS' THEN NULL WHEN 'COB-RAS' THEN NULL ELSE 100 END::numeric,
  CASE c.codigo WHEN 'COB-ASS' THEN 400 ELSE NULL END::numeric,
  c.carencia_dias, NULL::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'LANÇAMENTO BASIC'
  AND c.codigo IN ('COB-COL','COB-ROU','COB-INC','COB-ALA','COB-GRA','COB-PT','COB-ASS','COB-RAS')

UNION ALL

SELECT p.id, c.id,
  CASE c.codigo WHEN 'COB-TER' THEN NULL WHEN 'COB-ASS' THEN NULL WHEN 'COB-RAS' THEN NULL ELSE 100 END::numeric,
  CASE c.codigo WHEN 'COB-TER' THEN 40000 WHEN 'COB-ASS' THEN 1000 ELSE NULL END::numeric,
  c.carencia_dias, NULL::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'LANÇAMENTO PREMIUM'
  AND c.codigo IN ('COB-COL','COB-ROU','COB-INC','COB-ALA','COB-GRA','COB-PT','COB-TER','COB-VID','COB-ASS','COB-RAS')

UNION ALL

SELECT p.id, c.id,
  CASE c.codigo WHEN 'COB-TER' THEN NULL WHEN 'COB-ASS' THEN NULL WHEN 'COB-RAS' THEN NULL WHEN 'COB-RES' THEN NULL ELSE 100 END::numeric,
  CASE c.codigo WHEN 'COB-TER' THEN 40000 WHEN 'COB-ASS' THEN 1000 WHEN 'COB-RES' THEN 30 ELSE NULL END::numeric,
  c.carencia_dias, NULL::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'LANÇAMENTO EXCLUSIVE'
  AND c.codigo IN ('COB-COL','COB-ROU','COB-INC','COB-ALA','COB-GRA','COB-PT','COB-TER','COB-VID','COB-ASS','COB-RAS','COB-RES')

UNION ALL

SELECT p.id, c.id,
  CASE c.codigo WHEN 'COB-TER' THEN NULL WHEN 'COB-ASS' THEN NULL WHEN 'COB-RAS' THEN NULL WHEN 'COB-RES' THEN NULL ELSE 100 END::numeric,
  CASE c.codigo WHEN 'COB-TER' THEN 40000 WHEN 'COB-ASS' THEN 1000 WHEN 'COB-RES' THEN 30 ELSE NULL END::numeric,
  c.carencia_dias, NULL::numeric,
  CASE c.codigo WHEN 'COB-RAS' THEN false ELSE true END
FROM planos p, coberturas c
WHERE p.nome = 'LANÇAMENTO EXCLUSIVE APLICATIVO'
  AND c.codigo IN ('COB-COL','COB-ROU','COB-INC','COB-ALA','COB-GRA','COB-PT','COB-TER','COB-VID','COB-ASS','COB-RAS','COB-RES')

ON CONFLICT DO NOTHING;


INSERT INTO planos_coberturas 
  (plano_id, cobertura_id, percentual_cobertura, valor_limite, 
   carencia_dias, franquia_valor, obrigatoria)

-- SELECT BASIC
SELECT p.id, c.id,
  CASE c.codigo
    WHEN 'COB-ASS' THEN NULL
    WHEN 'COB-RAS' THEN NULL
    ELSE 100
  END::numeric,
  CASE c.codigo
    WHEN 'COB-ASS' THEN 400
    ELSE NULL
  END::numeric,
  c.carencia_dias,
  NULL::numeric,
  CASE c.codigo
    WHEN 'COB-RAS' THEN false
    ELSE true
  END
FROM planos p, coberturas c
WHERE p.nome = 'SELECT BASIC'
  AND c.codigo IN ('COB-COL','COB-ROU','COB-INC','COB-ALA',
                   'COB-GRA','COB-PT','COB-ASS','COB-RAS')

UNION ALL

-- SELECT PREMIUM
SELECT p.id, c.id,
  CASE c.codigo
    WHEN 'COB-TER' THEN NULL
    WHEN 'COB-ASS' THEN NULL
    WHEN 'COB-RAS' THEN NULL
    ELSE 100
  END::numeric,
  CASE c.codigo
    WHEN 'COB-TER' THEN 40000
    WHEN 'COB-ASS' THEN 1000
    ELSE NULL
  END::numeric,
  c.carencia_dias,
  NULL::numeric,
  CASE c.codigo
    WHEN 'COB-RAS' THEN false
    ELSE true
  END
FROM planos p, coberturas c
WHERE p.nome = 'SELECT PREMIUM'
  AND c.codigo IN ('COB-COL','COB-ROU','COB-INC','COB-ALA',
                   'COB-GRA','COB-PT','COB-TER','COB-VID',
                   'COB-ASS','COB-RAS')

ON CONFLICT DO NOTHING;

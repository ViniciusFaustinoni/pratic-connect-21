WITH grupos AS (
  SELECT vistoria_origem_id
  FROM public.servicos
  WHERE vistoria_origem_id IS NOT NULL
  GROUP BY vistoria_origem_id
  HAVING COUNT(*) > 1
),
canonicos AS (
  SELECT DISTINCT ON (s.vistoria_origem_id) s.vistoria_origem_id, s.id AS canonico_id
  FROM public.servicos s
  JOIN grupos g ON g.vistoria_origem_id = s.vistoria_origem_id
  ORDER BY s.vistoria_origem_id,
    CASE WHEN s.status NOT IN ('cancelada','reprovada') THEN 0 ELSE 1 END,
    s.created_at DESC
)
UPDATE public.servicos s
SET dedup_substituido_por = c.canonico_id,
    observacoes = COALESCE(s.observacoes || E'\n', '') || '[SANEAMENTO PR-R1a] Vinculado ao canônico ' || c.canonico_id::text || ' em ' || now()::text
FROM canonicos c
WHERE s.vistoria_origem_id = c.vistoria_origem_id
  AND s.id <> c.canonico_id
  AND s.dedup_substituido_por IS NULL
  AND s.status IN ('cancelada','reprovada');
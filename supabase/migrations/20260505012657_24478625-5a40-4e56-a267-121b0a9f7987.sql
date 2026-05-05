
CREATE OR REPLACE FUNCTION public.contratos_status_counts(
  p_vendedor_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_like text := CASE WHEN p_search IS NOT NULL AND length(trim(p_search)) > 0
                      THEN '%' || trim(p_search) || '%'
                      ELSE NULL END;
  v_result jsonb;
BEGIN
  WITH base AS (
    SELECT c.id, c.status, c.valor_mensal
    FROM public.contratos c
    LEFT JOIN public.associados a ON a.id = c.associado_id
    LEFT JOIN public.leads      l ON l.id = c.lead_id
    WHERE
      (p_vendedor_id IS NULL OR c.vendedor_id = p_vendedor_id)
      AND (
        v_like IS NULL
        OR c.numero ILIKE v_like
        OR a.nome   ILIKE v_like
        OR a.cpf    ILIKE v_like
        OR l.nome   ILIKE v_like
      )
  ),
  counts AS (
    SELECT status::text AS status, COUNT(*)::int AS qty
    FROM base
    GROUP BY status
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*)::int FROM base),
    'valor_mensal_ativo', COALESCE((
      SELECT SUM(valor_mensal)::numeric
      FROM base
      WHERE status::text = 'ativo'
    ), 0),
    'por_status', COALESCE((
      SELECT jsonb_object_agg(status, qty) FROM counts
    ), '{}'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

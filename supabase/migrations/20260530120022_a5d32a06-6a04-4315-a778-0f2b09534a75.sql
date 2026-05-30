-- ERRO 14: Observabilidade SGA Hinova
ALTER TABLE public.sga_health_checks
  ADD COLUMN IF NOT EXISTS taxa_sucesso_24h    numeric(5,4),
  ADD COLUMN IF NOT EXISTS total_operacoes_24h integer;

CREATE OR REPLACE FUNCTION public.sga_success_rate_by_action(janela_horas int DEFAULT 24)
RETURNS TABLE (
  action text,
  total bigint,
  ok bigint,
  falha bigint,
  taxa_sucesso numeric,
  duracao_media_ms numeric,
  ultimo_erro text,
  ultimo_erro_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    l.action,
    COUNT(*) FILTER (WHERE l.status <> 'skipped')            AS total,
    COUNT(*) FILTER (WHERE l.status = 'ok')                  AS ok,
    COUNT(*) FILTER (WHERE l.status NOT IN ('ok','skipped')) AS falha,
    CASE WHEN COUNT(*) FILTER (WHERE l.status <> 'skipped') = 0 THEN NULL
         ELSE ROUND(
           COUNT(*) FILTER (WHERE l.status = 'ok')::numeric
           / NULLIF(COUNT(*) FILTER (WHERE l.status <> 'skipped'), 0),
         4) END                                              AS taxa_sucesso,
    ROUND(AVG(l.duracao_ms) FILTER (WHERE l.status <> 'skipped'), 0) AS duracao_media_ms,
    (ARRAY_AGG(l.error_message ORDER BY l.created_at DESC)
       FILTER (WHERE l.status NOT IN ('ok','skipped')))[1]   AS ultimo_erro,
    MAX(l.created_at) FILTER (WHERE l.status NOT IN ('ok','skipped')) AS ultimo_erro_em
  FROM   public.sga_sync_logs l
  WHERE  l.created_at >= now() - make_interval(hours => janela_horas)
  GROUP  BY l.action
  ORDER  BY taxa_sucesso ASC NULLS LAST, total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.sga_success_rate_by_action(int) TO authenticated, service_role;
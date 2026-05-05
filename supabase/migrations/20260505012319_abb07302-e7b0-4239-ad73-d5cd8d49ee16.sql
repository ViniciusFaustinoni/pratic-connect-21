
CREATE OR REPLACE FUNCTION public.cotacoes_funil_counts(
  p_vendedor_id uuid DEFAULT NULL,
  p_view_scope text DEFAULT 'own',
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
                      THEN '%' || regexp_replace(p_search, '[,()]', '', 'g') || '%'
                      ELSE NULL END;
  v_result jsonb;
BEGIN
  WITH base AS (
    SELECT c.id, c.status, c.status_contratacao, c.vendedor_id, c.lead_id,
           c.numero, c.veiculo_placa, c.veiculo_marca, c.veiculo_modelo,
           c.nome_solicitante, c.telefone1_solicitante, c.telefone2_solicitante,
           c.email_solicitante
    FROM public.cotacoes c
    WHERE
      (
        p_view_scope IN ('team','all')
        OR p_vendedor_id IS NULL
        OR c.vendedor_id = p_vendedor_id
      )
      AND (
        v_like IS NULL
        OR c.numero ILIKE v_like
        OR c.veiculo_placa ILIKE v_like
        OR c.veiculo_marca ILIKE v_like
        OR c.veiculo_modelo ILIKE v_like
        OR c.nome_solicitante ILIKE v_like
        OR c.telefone1_solicitante ILIKE v_like
        OR c.telefone2_solicitante ILIKE v_like
        OR c.email_solicitante ILIKE v_like
        OR EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.id = c.lead_id
            AND (l.nome ILIKE v_like OR l.telefone ILIKE v_like OR l.email ILIKE v_like)
        )
      )
  )
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'em_andamento_total', COUNT(*) FILTER (
      WHERE status::text IN ('rascunho','enviada')
        AND COALESCE(status_contratacao,'') <> 'concluido'
    ),
    'finalizadas_total', COUNT(*) FILTER (
      WHERE status::text IN ('aceita','recusada','expirada')
         OR status_contratacao = 'concluido'
    ),
    'rascunho', COUNT(*) FILTER (WHERE status::text = 'rascunho'),
    'enviada', COUNT(*) FILTER (
      WHERE status::text = 'enviada' AND COALESCE(status_contratacao,'') = ''
    ),
    'escolhendo_plano', COUNT(*) FILTER (
      WHERE status_contratacao IN ('escolhendo_plano','plano_escolhido')
    ),
    'enviando_documentos', COUNT(*) FILTER (
      WHERE status_contratacao IN ('enviando_documentos','dados_preenchidos')
    ),
    'em_analise', COUNT(*) FILTER (WHERE status_contratacao = 'em_analise'),
    'assinando_contrato', COUNT(*) FILTER (WHERE status_contratacao = 'assinando_contrato'),
    'pagando_taxa', COUNT(*) FILTER (WHERE status_contratacao = 'pagando_taxa'),
    'agendando_vistoria', COUNT(*) FILTER (WHERE status_contratacao = 'agendando_vistoria'),
    'concluido', COUNT(*) FILTER (
      WHERE status::text = 'aceita' OR status_contratacao = 'concluido'
    ),
    'perdida', COUNT(*) FILTER (WHERE status::text IN ('recusada','expirada'))
  )
  INTO v_result
  FROM base;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

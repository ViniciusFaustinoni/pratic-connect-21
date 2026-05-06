-- =============================================================================
-- Fase 2.1: KPIs alinhados com filtros — uma única RPC por página
-- =============================================================================

CREATE OR REPLACE FUNCTION public.associados_contagem_por_status(
  p_search text DEFAULT NULL,
  p_plano_id uuid DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_vendedor_id uuid DEFAULT NULL,
  p_tipos_entrada text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_search_pat text := CASE WHEN v_search IS NOT NULL THEN '%' || v_search || '%' ELSE NULL END;
  v_associado_ids uuid[];
BEGIN
  -- Pré-filtro por contratos quando vendedor/tipo_entrada estão presentes
  IF p_vendedor_id IS NOT NULL OR (p_tipos_entrada IS NOT NULL AND array_length(p_tipos_entrada, 1) > 0) THEN
    SELECT array_agg(DISTINCT c.associado_id)
      INTO v_associado_ids
      FROM contratos c
     WHERE c.associado_id IS NOT NULL
       AND (p_vendedor_id IS NULL OR c.vendedor_id = p_vendedor_id)
       AND (
            p_tipos_entrada IS NULL
            OR array_length(p_tipos_entrada, 1) IS NULL
            OR c.tipo_entrada = ANY(p_tipos_entrada)
       );
    IF v_associado_ids IS NULL OR array_length(v_associado_ids, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'total', 0,
        'em_analise', 0, 'pendente_vistoria', 0, 'aprovado', 0,
        'documentacao_pendente', 0, 'aguardando_instalacao', 0,
        'ativo', 0, 'inadimplente', 0, 'suspenso', 0,
        'cancelado', 0, 'bloqueado', 0, 'recusado', 0
      );
    END IF;
  END IF;

  WITH base AS (
    SELECT a.status::text AS status
      FROM associados a
     WHERE (p_plano_id IS NULL OR a.plano_id = p_plano_id)
       AND (p_cidade IS NULL OR a.cidade = p_cidade)
       AND (p_uf IS NULL OR a.uf = p_uf)
       AND (p_data_inicio IS NULL OR a.data_adesao >= p_data_inicio)
       AND (p_data_fim IS NULL OR a.data_adesao <= p_data_fim)
       AND (v_associado_ids IS NULL OR a.id = ANY(v_associado_ids))
       AND (
            v_search IS NULL
            OR a.nome ILIKE v_search_pat
            OR a.email ILIKE v_search_pat
            OR a.cpf ILIKE v_search_pat
            OR a.telefone ILIKE v_search_pat
       )
  )
  SELECT jsonb_build_object(
    'total', count(*),
    'em_analise', count(*) FILTER (WHERE status = 'em_analise'),
    'pendente_vistoria', count(*) FILTER (WHERE status = 'pendente_vistoria'),
    'aprovado', count(*) FILTER (WHERE status = 'aprovado'),
    'documentacao_pendente', count(*) FILTER (WHERE status = 'documentacao_pendente'),
    'aguardando_instalacao', count(*) FILTER (WHERE status = 'aguardando_instalacao'),
    'ativo', count(*) FILTER (WHERE status = 'ativo'),
    'inadimplente', count(*) FILTER (WHERE status = 'inadimplente'),
    'suspenso', count(*) FILTER (WHERE status = 'suspenso'),
    'cancelado', count(*) FILTER (WHERE status = 'cancelado'),
    'bloqueado', count(*) FILTER (WHERE status = 'bloqueado'),
    'recusado', count(*) FILTER (WHERE status = 'recusado')
  )
  INTO v_result
  FROM base;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.associados_contagem_por_status(
  text, uuid, text, text, date, date, uuid, text[]
) TO authenticated;

-- =============================================================================

CREATE OR REPLACE FUNCTION public.veiculos_stats_filtrados(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_pat text := CASE WHEN v_search IS NOT NULL THEN '%' || v_search || '%' ELSE NULL END;
BEGIN
  WITH base AS (
    SELECT v.status::text AS status, v.valor_fipe
      FROM veiculos v
     WHERE (p_status IS NULL OR p_status = 'all' OR v.status::text = p_status)
       AND (
            v_search IS NULL
            OR v.placa ILIKE v_pat
            OR v.marca ILIKE v_pat
            OR v.modelo ILIKE v_pat
            OR coalesce(v.chassi, '') ILIKE v_pat
       )
  )
  SELECT jsonb_build_object(
    'total', count(*),
    'ativos', count(*) FILTER (WHERE status = 'ativo'),
    'valor_fipe_total', coalesce(sum(valor_fipe) FILTER (WHERE status = 'ativo'), 0)
  )
  INTO v_result
  FROM base;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.veiculos_stats_filtrados(text, text) TO authenticated;
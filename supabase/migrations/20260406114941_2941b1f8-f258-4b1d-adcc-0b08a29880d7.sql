
DROP FUNCTION IF EXISTS public.veiculos_sem_rastreador_ids();

CREATE OR REPLACE FUNCTION public.veiculos_base_antiga_sem_rastreador(
  p_search text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_data json;
BEGIN
  -- Count
  SELECT count(*) INTO v_total
  FROM veiculos v
  INNER JOIN associados a ON a.id = v.associado_id AND a.origem_cadastro = 'api_externa'
  LEFT JOIN rastreadores r ON r.veiculo_id = v.id
  WHERE r.id IS NULL
    AND (p_search IS NULL OR p_search = '' OR
         v.placa ILIKE '%' || p_search || '%' OR
         v.chassi ILIKE '%' || p_search || '%' OR
         v.marca ILIKE '%' || p_search || '%' OR
         v.modelo ILIKE '%' || p_search || '%');

  -- Data
  SELECT json_agg(row_to_json(t)) INTO v_data
  FROM (
    SELECT v.id, v.placa, v.marca, v.modelo, v.ano_fabricacao, v.ano_modelo,
           v.cor, v.chassi, v.status, v.associado_id,
           json_build_object('id', a.id, 'nome', a.nome, 'cpf', a.cpf, 'origem_cadastro', a.origem_cadastro) as associado
    FROM veiculos v
    INNER JOIN associados a ON a.id = v.associado_id AND a.origem_cadastro = 'api_externa'
    LEFT JOIN rastreadores r ON r.veiculo_id = v.id
    WHERE r.id IS NULL
      AND (p_search IS NULL OR p_search = '' OR
           v.placa ILIKE '%' || p_search || '%' OR
           v.chassi ILIKE '%' || p_search || '%' OR
           v.marca ILIKE '%' || p_search || '%' OR
           v.modelo ILIKE '%' || p_search || '%')
    ORDER BY v.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN json_build_object('total', v_total, 'data', COALESCE(v_data, '[]'::json));
END;
$$;

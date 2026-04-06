
CREATE OR REPLACE FUNCTION public.veiculos_sem_rastreador_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id
  FROM veiculos v
  INNER JOIN associados a ON a.id = v.associado_id AND a.origem_cadastro = 'api_externa'
  LEFT JOIN rastreadores r ON r.veiculo_id = v.id
  WHERE r.id IS NULL;
$$;

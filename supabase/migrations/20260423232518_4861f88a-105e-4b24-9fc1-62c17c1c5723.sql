CREATE OR REPLACE FUNCTION public.fn_resolver_grade_vendedor_em(
  p_vendedor_id uuid,
  p_data_referencia timestamp with time zone
)
RETURNS TABLE(grade_id uuid, versao_id uuid, snapshot jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_grade_id uuid;
BEGIN
  SELECT ugc.grade_id
    INTO v_grade_id
  FROM public.usuario_grade_comissao ugc
  WHERE ugc.user_id = p_vendedor_id
    AND (ugc.data_inicio IS NULL OR ugc.data_inicio <= p_data_referencia)
    AND (ugc.data_fim IS NULL OR ugc.data_fim > p_data_referencia)
  ORDER BY ugc.data_inicio DESC NULLS LAST
  LIMIT 1;

  IF v_grade_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v.grade_id, v.id AS versao_id, v.snapshot
  FROM public.grades_comissao_versoes v
  WHERE v.grade_id = v_grade_id
    AND v.vigente_desde <= p_data_referencia
  ORDER BY v.vigente_desde DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT v.grade_id, v.id, v.snapshot
    FROM public.grades_comissao_versoes v
    WHERE v.grade_id = v_grade_id
    ORDER BY v.vigente_desde ASC
    LIMIT 1;
  END IF;
END;
$function$;
CREATE OR REPLACE FUNCTION public.fn_associado_em_estado_terminal(_associado_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT status::text
  FROM public.associados
  WHERE id = _associado_id
    AND status::text IN ('cancelado','cancelamento_solicitado','recusado','inadimplente_terminal')
  LIMIT 1;
$function$;
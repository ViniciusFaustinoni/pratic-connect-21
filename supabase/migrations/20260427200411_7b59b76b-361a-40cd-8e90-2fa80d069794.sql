CREATE OR REPLACE FUNCTION public.fn_reativar_cobertura_pos_instalacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo = 'instalacao'
     AND NEW.status = 'concluida'
     AND (OLD.status IS DISTINCT FROM 'concluida'::status_servico)
     AND NEW.veiculo_id IS NOT NULL THEN
    UPDATE public.veiculos
       SET cobertura_suspensa = false,
           cobertura_suspensa_motivo = NULL,
           cobertura_suspensa_em = NULL,
           cobertura_total = true,
           cobertura_roubo_furto = true
     WHERE id = NEW.veiculo_id
       AND cobertura_suspensa = true;
  END IF;
  RETURN NEW;
END;
$function$;
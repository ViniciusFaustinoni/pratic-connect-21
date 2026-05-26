CREATE OR REPLACE FUNCTION public.trg_bloquear_servico_se_terminal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  IF NEW.status::text IN ('concluida','aprovada') AND COALESCE(OLD.status::text,'') <> NEW.status::text THEN
    -- Serviços de saída do sistema (retirada de rastreador, vistoria de saída)
    -- são justamente executados APÓS o cancelamento do associado. Não bloquear.
    IF NEW.tipo::text IN ('vistoria_retirada','vistoria_saida') THEN
      RETURN NEW;
    END IF;
    IF NEW.associado_id IS NOT NULL THEN
      v_status := public.fn_associado_em_estado_terminal(NEW.associado_id);
      IF v_status IS NOT NULL THEN
        RAISE EXCEPTION 'Não é possível concluir serviço: associado está em status "%"', v_status
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
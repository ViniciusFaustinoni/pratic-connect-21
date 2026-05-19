
-- Estende fn_vistorias_autopreencher_vinculos para também resolver veiculo_id
CREATE OR REPLACE FUNCTION public.fn_vistorias_autopreencher_vinculos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contrato_id   uuid;
  v_cotacao_id    uuid;
  v_associado_id  uuid;
  v_veiculo_id    uuid;
BEGIN
  IF NEW.contrato_id IS NOT NULL
     AND NEW.cotacao_id IS NOT NULL
     AND NEW.associado_id IS NOT NULL
     AND NEW.veiculo_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Via instalacao_id (mais específico) — agora também traz veiculo_id
  IF NEW.instalacao_id IS NOT NULL THEN
    SELECT i.contrato_id, i.cotacao_id, i.associado_id, i.veiculo_id
      INTO v_contrato_id, v_cotacao_id, v_associado_id, v_veiculo_id
      FROM public.instalacoes i
     WHERE i.id = NEW.instalacao_id;
  END IF;

  -- 2) Via veiculo_id já presente → contrato ativo
  IF (v_contrato_id IS NULL AND NEW.contrato_id IS NULL) AND NEW.veiculo_id IS NOT NULL THEN
    SELECT c.id, c.cotacao_id, c.associado_id
      INTO v_contrato_id, v_cotacao_id, v_associado_id
      FROM public.contratos c
     WHERE c.veiculo_id = NEW.veiculo_id
       AND c.status NOT IN ('cancelado')
     ORDER BY c.created_at DESC
     LIMIT 1;
  END IF;

  -- 3) Via cotacao_id
  IF (v_contrato_id IS NULL AND NEW.contrato_id IS NULL) AND NEW.cotacao_id IS NOT NULL THEN
    SELECT c.id, c.associado_id, c.veiculo_id
      INTO v_contrato_id, v_associado_id, v_veiculo_id
      FROM public.contratos c
     WHERE c.cotacao_id = NEW.cotacao_id
       AND c.status NOT IN ('cancelado')
     ORDER BY c.created_at DESC
     LIMIT 1;
  END IF;

  -- 4) Fallback veiculo via contrato resolvido
  IF v_veiculo_id IS NULL AND NEW.veiculo_id IS NULL AND COALESCE(NEW.contrato_id, v_contrato_id) IS NOT NULL THEN
    SELECT c.veiculo_id
      INTO v_veiculo_id
      FROM public.contratos c
     WHERE c.id = COALESCE(NEW.contrato_id, v_contrato_id);
  END IF;

  IF NEW.contrato_id  IS NULL AND v_contrato_id  IS NOT NULL THEN NEW.contrato_id  := v_contrato_id;  END IF;
  IF NEW.cotacao_id   IS NULL AND v_cotacao_id   IS NOT NULL THEN NEW.cotacao_id   := v_cotacao_id;   END IF;
  IF NEW.associado_id IS NULL AND v_associado_id IS NOT NULL THEN NEW.associado_id := v_associado_id; END IF;
  IF NEW.veiculo_id   IS NULL AND v_veiculo_id   IS NOT NULL THEN NEW.veiculo_id   := v_veiculo_id;   END IF;

  RETURN NEW;
END;
$function$;

-- Backfill 1: via instalacoes.veiculo_id
UPDATE public.vistorias v
   SET veiculo_id = i.veiculo_id
  FROM public.instalacoes i
 WHERE v.instalacao_id = i.id
   AND v.veiculo_id IS NULL
   AND i.veiculo_id IS NOT NULL;

-- Backfill 2: via contratos.veiculo_id (vistorias sem instalacao_id)
UPDATE public.vistorias v
   SET veiculo_id = c.veiculo_id
  FROM public.contratos c
 WHERE v.contrato_id = c.id
   AND v.veiculo_id IS NULL
   AND c.veiculo_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_sync_veiculo_associado_from_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_em_troca boolean;
BEGIN
  IF NEW.veiculo_id IS NULL OR NEW.associado_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT associado_id, COALESCE(em_troca_titularidade, false)
    INTO v_owner, v_em_troca
    FROM public.veiculos
   WHERE id = NEW.veiculo_id;

  -- Em troca de titularidade legítima: NÃO realinhar.
  -- A transferência ocorre explicitamente em efetivar-troca-titularidade.
  IF v_em_troca THEN
    RAISE NOTICE 'fn_sync_veiculo_associado_from_contrato: skip (veiculo % em troca de titularidade)', NEW.veiculo_id;
    RETURN NEW;
  END IF;

  IF v_owner IS DISTINCT FROM NEW.associado_id THEN
    UPDATE public.veiculos
       SET associado_id = NEW.associado_id,
           updated_at   = now()
     WHERE id = NEW.veiculo_id;

    RAISE NOTICE 'fn_sync_veiculo_associado_from_contrato: realinhado veiculo % de % para % (contrato %)',
      NEW.veiculo_id, v_owner, NEW.associado_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
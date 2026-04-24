CREATE OR REPLACE FUNCTION public.enfileirar_atualizacao_placa_sga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_placeholder boolean;
  v_is_placeholder boolean;
BEGIN
  v_was_placeholder := COALESCE(OLD.placa, '') ~* '^0KM[A-Z0-9]{5}$';
  v_is_placeholder := COALESCE(NEW.placa, '') ~* '^0KM[A-Z0-9]{5}$';

  IF NEW.placa IS DISTINCT FROM OLD.placa
     AND v_was_placeholder
     AND NOT v_is_placeholder
     AND NEW.codigo_hinova IS NOT NULL THEN

    NEW.aguardando_placa_definitiva := false;
    NEW.placa_definitiva_atualizada_em := now();

    INSERT INTO public.sga_sync_queue
      (veiculo_id, associado_id, status, tentativas,
       ultima_tentativa_em, proximo_reenvio_em, erro_ultimo,
       etapa_parou, codigo_veiculo_hinova, origem)
    VALUES
      (NEW.id, NEW.associado_id, 'pendente', 0,
       now(), now(), 'Aguardando atualização da placa definitiva no SGA',
       'atualizar_placa', NEW.codigo_hinova::int, 'trigger_emplacamento')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
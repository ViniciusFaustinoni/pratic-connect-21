CREATE OR REPLACE FUNCTION public.fn_troca_cancelada_cancela_contrato_orfao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('cancelada','expirada')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('cancelada','expirada')) THEN
    UPDATE public.contratos
    SET status = 'cancelado',
        data_cancelamento = now(),
        updated_at = now()
    WHERE origem_troca_titularidade_id = NEW.id
      AND status IN ('pendente','assinado','ativo');
  END IF;
  RETURN NEW;
END;
$$;
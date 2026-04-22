CREATE OR REPLACE FUNCTION public.tg_troca_vistoria_concluida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'concluida'::status_servico
     AND (OLD.status IS DISTINCT FROM 'concluida'::status_servico) THEN
    UPDATE public.solicitacoes_troca_titularidade
       SET status = 'liberada_para_assinatura',
           updated_at = now()
     WHERE servico_vistoria_id = NEW.id
       AND status = 'aguardando_vistoria';
  END IF;
  RETURN NEW;
END;
$$;
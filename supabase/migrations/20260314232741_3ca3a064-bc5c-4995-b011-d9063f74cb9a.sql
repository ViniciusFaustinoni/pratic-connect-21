CREATE OR REPLACE FUNCTION public.sync_vistoria_update_to_servicos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.servicos SET
    profissional_id = NEW.vistoriador_id,
    data_agendada = NEW.data_agendada,
    status = public.map_to_status_servico(NEW.status::text),
    logradouro = COALESCE(NEW.endereco_logradouro, servicos.logradouro),
    numero = COALESCE(NEW.endereco_numero, servicos.numero),
    bairro = COALESCE(NEW.endereco_bairro, servicos.bairro),
    cidade = COALESCE(NEW.endereco_cidade, servicos.cidade),
    uf = COALESCE(NEW.endereco_uf, servicos.uf),
    latitude = COALESCE(NEW.endereco_latitude, servicos.latitude),
    longitude = COALESCE(NEW.endereco_longitude, servicos.longitude),
    updated_at = now()
  WHERE vistoria_origem_id = NEW.id;
  RETURN NEW;
END;
$function$;
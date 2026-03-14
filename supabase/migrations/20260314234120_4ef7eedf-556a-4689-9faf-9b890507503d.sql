
-- Validate required columns exist before applying
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vistorias' AND column_name='endereco_estado') THEN
    RAISE EXCEPTION 'Column "endereco_estado" does not exist in table "vistorias".';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vistorias' AND column_name='horario_agendado') THEN
    RAISE EXCEPTION 'Column "horario_agendado" does not exist in table "vistorias".';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_vistoria_update_to_servicos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.servicos SET
    profissional_id = NEW.vistoriador_id,
    data_agendada = COALESCE(NEW.data_agendada, servicos.data_agendada),
    hora_agendada = COALESCE(NEW.horario_agendado, servicos.hora_agendada),
    status = public.map_to_status_servico(NEW.status::text),
    logradouro = COALESCE(NEW.endereco_logradouro, servicos.logradouro),
    numero = COALESCE(NEW.endereco_numero, servicos.numero),
    bairro = COALESCE(NEW.endereco_bairro, servicos.bairro),
    cidade = COALESCE(NEW.endereco_cidade, servicos.cidade),
    uf = COALESCE(NEW.endereco_estado, servicos.uf),
    latitude = COALESCE(NEW.endereco_latitude, servicos.latitude),
    longitude = COALESCE(NEW.endereco_longitude, servicos.longitude),
    updated_at = now()
  WHERE vistoria_origem_id = NEW.id;
  RETURN NEW;
END;
$function$;

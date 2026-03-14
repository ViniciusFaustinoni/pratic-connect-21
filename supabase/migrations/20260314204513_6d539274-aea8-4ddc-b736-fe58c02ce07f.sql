
-- Proteger coordenadas contra sobrescrita por null nos triggers de sincronização

-- Recriar trigger function para sync instalacao -> servicos (protegendo coords)
CREATE OR REPLACE FUNCTION public.sync_instalacao_update_to_servicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.servicos SET
    profissional_id = NEW.instalador_responsavel_id,
    data_agendada = NEW.data_agendada,
    hora_agendada = NEW.hora_agendada,
    status = NEW.status,
    logradouro = COALESCE(NEW.logradouro, servicos.logradouro),
    numero = COALESCE(NEW.numero, servicos.numero),
    bairro = COALESCE(NEW.bairro, servicos.bairro),
    cidade = COALESCE(NEW.cidade, servicos.cidade),
    uf = COALESCE(NEW.uf, servicos.uf),
    cep = COALESCE(NEW.cep, servicos.cep),
    latitude = COALESCE(NEW.endereco_latitude, servicos.latitude),
    longitude = COALESCE(NEW.endereco_longitude, servicos.longitude),
    updated_at = now()
  WHERE instalacao_origem_id = NEW.id;
  RETURN NEW;
END;
$$;

-- Recriar trigger function para sync vistoria -> servicos (protegendo coords)
CREATE OR REPLACE FUNCTION public.sync_vistoria_update_to_servicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.servicos SET
    profissional_id = NEW.vistoriador_id,
    data_agendada = NEW.data_agendada,
    hora_agendada = NEW.hora_agendada,
    status = NEW.status,
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
$$;

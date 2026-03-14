-- Helper function: safely maps any text to status_servico enum
-- Used by sync triggers to avoid enum type mismatch errors (42804)
CREATE OR REPLACE FUNCTION public.map_to_status_servico(p_status text)
RETURNS status_servico
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'pendente'         THEN 'pendente'::status_servico
    WHEN 'agendada'         THEN 'agendada'::status_servico
    WHEN 'em_rota'          THEN 'em_rota'::status_servico
    WHEN 'em_andamento'     THEN 'em_andamento'::status_servico
    WHEN 'concluida'        THEN 'concluida'::status_servico
    WHEN 'aprovada'         THEN 'aprovada'::status_servico
    WHEN 'reprovada'        THEN 'reprovada'::status_servico
    WHEN 'aprovada_ressalvas' THEN 'aprovada_ressalvas'::status_servico
    WHEN 'em_analise'       THEN 'em_analise'::status_servico
    WHEN 'reagendada'       THEN 'reagendada'::status_servico
    WHEN 'cancelada'        THEN 'cancelada'::status_servico
    WHEN 'nao_compareceu'   THEN 'nao_compareceu'::status_servico
    ELSE 'agendada'::status_servico
  END;
$$;

-- Fix sync_instalacao_update_to_servicos: cast status via text mapping
CREATE OR REPLACE FUNCTION public.sync_instalacao_update_to_servicos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.servicos SET
    profissional_id = NEW.instalador_responsavel_id,
    data_agendada = NEW.data_agendada,
    hora_agendada = NEW.hora_agendada,
    status = public.map_to_status_servico(NEW.status::text),
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
$function$;

-- Fix sync_vistoria_update_to_servicos: cast status via text mapping
CREATE OR REPLACE FUNCTION public.sync_vistoria_update_to_servicos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.servicos SET
    profissional_id = NEW.vistoriador_id,
    data_agendada = NEW.data_agendada,
    hora_agendada = NEW.hora_agendada,
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
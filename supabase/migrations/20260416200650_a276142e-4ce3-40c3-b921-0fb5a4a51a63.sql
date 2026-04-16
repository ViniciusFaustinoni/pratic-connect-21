
-- Fix: previous version referenced NEW.periodo, which does not exist on
-- vistorias (the column is horario_agendado). servicos requires periodo
-- NOT NULL, so derive it from the time of day.

CREATE OR REPLACE FUNCTION public.sync_vistoria_to_servicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo tipo_servico;
  v_hora time;
  v_periodo periodo_servico;
BEGIN
  -- Map vistorias.tipo (tipo_vistoria) -> servicos.tipo (tipo_servico)
  v_tipo := CASE NEW.tipo::text
    WHEN 'entrada'  THEN 'vistoria_entrada'::tipo_servico
    WHEN 'saida'    THEN 'vistoria_saida'::tipo_servico
    WHEN 'sinistro' THEN 'vistoria_sinistro'::tipo_servico
    ELSE 'vistoria_entrada'::tipo_servico
  END;

  -- horario_agendado may be timestamptz, time or null
  BEGIN
    v_hora := COALESCE(NEW.horario_agendado::time, '09:00:00'::time);
  EXCEPTION WHEN others THEN
    v_hora := '09:00:00'::time;
  END;

  v_periodo := CASE
    WHEN v_hora < '12:00:00'::time THEN 'manha'::periodo_servico
    WHEN v_hora < '18:00:00'::time THEN 'tarde'::periodo_servico
    ELSE 'noite'::periodo_servico
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.servicos (
      tipo,
      status,
      data_agendada,
      hora_agendada,
      periodo,
      profissional_id,
      associado_id,
      veiculo_id,
      vistoria_origem_id,
      cep,
      logradouro,
      numero,
      bairro,
      cidade,
      rota_id,
      created_at,
      updated_at
    ) VALUES (
      v_tipo,
      COALESCE(NEW.status::text::status_servico, 'agendada'::status_servico),
      NEW.data_agendada::date,
      v_hora,
      v_periodo,
      NEW.vistoriador_id,
      NEW.associado_id,
      NEW.veiculo_id,
      NEW.id,
      NEW.endereco_cep,
      NEW.endereco_logradouro,
      NEW.endereco_numero,
      NEW.endereco_bairro,
      NEW.endereco_cidade,
      NEW.rota_id,
      now(),
      now()
    )
    ON CONFLICT (vistoria_origem_id) WHERE vistoria_origem_id IS NOT NULL
    DO UPDATE SET
      profissional_id = EXCLUDED.profissional_id,
      updated_at = now();

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.servicos SET
      status = COALESCE(NEW.status::text::status_servico, status),
      data_agendada = NEW.data_agendada::date,
      hora_agendada = v_hora,
      periodo = v_periodo,
      profissional_id = COALESCE(NEW.vistoriador_id, profissional_id),
      associado_id = NEW.associado_id,
      veiculo_id = NEW.veiculo_id,
      cep = NEW.endereco_cep,
      logradouro = NEW.endereco_logradouro,
      numero = NEW.endereco_numero,
      bairro = NEW.endereco_bairro,
      cidade = NEW.endereco_cidade,
      rota_id = NEW.rota_id,
      updated_at = now()
    WHERE vistoria_origem_id = NEW.id;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

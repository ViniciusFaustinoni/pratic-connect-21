-- Fix sync_vistoria_to_servicos: previous version inserted text literals
-- ('vistoria', 'vistoria_cotacao', etc.) into servicos.tipo, which is the
-- enum tipo_servico. Those labels do not exist in the enum, so any INSERT
-- into vistorias triggered a 22P02 -> PostgREST 400.
--
-- New mapping uses vistorias.tipo (tipo_vistoria: entrada/saida/sinistro)
-- and casts to the matching tipo_servico label.

CREATE OR REPLACE FUNCTION public.sync_vistoria_to_servicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo tipo_servico;
BEGIN
  -- Map vistorias.tipo (tipo_vistoria) -> servicos.tipo (tipo_servico)
  v_tipo := CASE NEW.tipo::text
    WHEN 'entrada'  THEN 'vistoria_entrada'::tipo_servico
    WHEN 'saida'    THEN 'vistoria_saida'::tipo_servico
    WHEN 'sinistro' THEN 'vistoria_sinistro'::tipo_servico
    ELSE 'vistoria_entrada'::tipo_servico
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.servicos (
      tipo,
      status,
      data_agendada,
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
      NEW.periodo,
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
      periodo = NEW.periodo,
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
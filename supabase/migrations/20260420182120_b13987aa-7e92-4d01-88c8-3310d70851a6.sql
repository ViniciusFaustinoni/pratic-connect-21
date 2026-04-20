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
  v_data date;
  v_existing_id uuid;
  v_active_servico_id uuid;
BEGIN
  v_tipo := CASE NEW.tipo::text
    WHEN 'entrada'  THEN 'vistoria_entrada'::tipo_servico
    WHEN 'saida'    THEN 'vistoria_saida'::tipo_servico
    WHEN 'sinistro' THEN 'vistoria_sinistro'::tipo_servico
    ELSE 'vistoria_entrada'::tipo_servico
  END;

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

  v_data := COALESCE(NEW.data_agendada::date, CURRENT_DATE);

  IF TG_OP = 'INSERT' THEN
    -- 1) Idempotência por vistoria_origem_id
    SELECT id INTO v_existing_id
      FROM public.servicos
     WHERE vistoria_origem_id = NEW.id
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.servicos
         SET profissional_id = COALESCE(NEW.vistoriador_id, profissional_id),
             updated_at = now()
       WHERE id = v_existing_id;
      RETURN NEW;
    END IF;

    -- 2) Se já existe serviço ATIVO para o mesmo trio (associado, veiculo, contrato),
    --    apenas vincula a vistoria — não cria duplicata.
    SELECT id INTO v_active_servico_id
      FROM public.servicos
     WHERE associado_id = NEW.associado_id
       AND veiculo_id   = NEW.veiculo_id
       AND COALESCE(contrato_id::text, '') = COALESCE(NEW.contrato_id::text, '')
       AND status IN ('agendada','em_rota','em_andamento','em_analise')
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_active_servico_id IS NOT NULL THEN
      UPDATE public.servicos
         SET vistoria_origem_id = NEW.id,
             updated_at = now()
       WHERE id = v_active_servico_id;
      RETURN NEW;
    END IF;

    -- 3) Caso geral: cria novo serviço de vistoria
    INSERT INTO public.servicos (
      tipo, status, data_agendada, hora_agendada, periodo,
      profissional_id, associado_id, veiculo_id, vistoria_origem_id,
      cep, logradouro, numero, bairro, cidade, rota_id,
      created_at, updated_at
    ) VALUES (
      v_tipo,
      COALESCE(NEW.status::text::status_servico, 'agendada'::status_servico),
      v_data,
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
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.servicos SET
      status = COALESCE(NEW.status::text::status_servico, status),
      data_agendada = v_data,
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
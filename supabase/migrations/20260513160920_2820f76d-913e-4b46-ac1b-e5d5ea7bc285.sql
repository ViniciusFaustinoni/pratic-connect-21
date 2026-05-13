-- Fix: triggers de sync vistoria/instalacao não podem regredir status nem sobrescrever profissional histórico

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
  v_has_instalacao boolean := false;
  v_current_status status_servico;
  v_new_status status_servico;
  v_terminal_statuses text[] := ARRAY['concluida','aprovada','reprovada','aprovada_ressalvas','cancelada'];
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
    SELECT id INTO v_existing_id FROM public.servicos WHERE vistoria_origem_id = NEW.id LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      UPDATE public.servicos
         SET profissional_id = COALESCE(profissional_id, NEW.vistoriador_id),
             updated_at = now()
       WHERE id = v_existing_id;
      RETURN NEW;
    END IF;

    IF v_tipo = 'vistoria_entrada' AND NEW.associado_id IS NOT NULL AND NEW.veiculo_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.servicos
         WHERE tipo = 'instalacao'
           AND associado_id = NEW.associado_id
           AND veiculo_id   = NEW.veiculo_id
           AND status::text IN ('agendada','em_rota','em_andamento','em_analise','concluida','aprovada','aprovada_ressalvas','nao_compareceu','reagendada')
      ) INTO v_has_instalacao;
      IF v_has_instalacao THEN
        RETURN NEW;
      END IF;
    END IF;

    SELECT id INTO v_active_servico_id
      FROM public.servicos
     WHERE associado_id = NEW.associado_id
       AND veiculo_id   = NEW.veiculo_id
       AND COALESCE(contrato_id::text, '') = COALESCE(NEW.contrato_id::text, '')
       AND status IN ('agendada','em_rota','em_andamento','em_analise')
     ORDER BY created_at DESC LIMIT 1;

    IF v_active_servico_id IS NOT NULL THEN
      UPDATE public.servicos
         SET vistoria_origem_id = NEW.id,
             updated_at = now()
       WHERE id = v_active_servico_id;
      RETURN NEW;
    END IF;

    INSERT INTO public.servicos (
      tipo, status, data_agendada, hora_agendada, periodo,
      profissional_id, associado_id, veiculo_id, vistoria_origem_id,
      cep, logradouro, numero, bairro, cidade, rota_id,
      created_at, updated_at
    ) VALUES (
      v_tipo,
      COALESCE(NEW.status::text::status_servico, 'agendada'::status_servico),
      v_data, v_hora, v_periodo,
      NEW.vistoriador_id, NEW.associado_id, NEW.veiculo_id, NEW.id,
      NEW.endereco_cep, NEW.endereco_logradouro, NEW.endereco_numero,
      NEW.endereco_bairro, NEW.endereco_cidade, NEW.rota_id,
      now(), now()
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Pega status atual do serviço para decidir se está em estado terminal
    SELECT status INTO v_current_status
      FROM public.servicos WHERE vistoria_origem_id = NEW.id LIMIT 1;

    v_new_status := COALESCE(NEW.status::text::status_servico, v_current_status);

    -- Se serviço está em estado TERMINAL: NÃO sobrescrever status, profissional, data, periodo.
    -- Apenas atualiza endereço/rota (metadados não-críticos).
    IF v_current_status::text = ANY(v_terminal_statuses) THEN
      UPDATE public.servicos SET
        cep = COALESCE(NEW.endereco_cep, cep),
        logradouro = COALESCE(NEW.endereco_logradouro, logradouro),
        numero = COALESCE(NEW.endereco_numero, numero),
        bairro = COALESCE(NEW.endereco_bairro, bairro),
        cidade = COALESCE(NEW.endereco_cidade, cidade),
        rota_id = COALESCE(NEW.rota_id, rota_id),
        updated_at = now()
      WHERE vistoria_origem_id = NEW.id;
      RETURN NEW;
    END IF;

    -- Caso normal: bloqueia regressão de status (ex.: 'concluida' não pode voltar para 'agendada')
    IF v_current_status::text IN ('em_andamento','em_analise','em_rota')
       AND v_new_status::text IN ('agendada','reagendada') THEN
      v_new_status := v_current_status;
    END IF;

    UPDATE public.servicos SET
      status = v_new_status,
      data_agendada = v_data,
      hora_agendada = v_hora,
      periodo = v_periodo,
      -- Preserva profissional original; só preenche se estiver vazio
      profissional_id = COALESCE(profissional_id, NEW.vistoriador_id),
      associado_id = COALESCE(associado_id, NEW.associado_id),
      veiculo_id = COALESCE(veiculo_id, NEW.veiculo_id),
      cep = COALESCE(NEW.endereco_cep, cep),
      logradouro = COALESCE(NEW.endereco_logradouro, logradouro),
      numero = COALESCE(NEW.endereco_numero, numero),
      bairro = COALESCE(NEW.endereco_bairro, bairro),
      cidade = COALESCE(NEW.endereco_cidade, cidade),
      rota_id = COALESCE(NEW.rota_id, rota_id),
      updated_at = now()
    WHERE vistoria_origem_id = NEW.id;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
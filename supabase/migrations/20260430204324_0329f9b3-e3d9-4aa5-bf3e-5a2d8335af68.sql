-- Permite que a RPC realocar_servico reabra serviços cancelados (e suas instalações).
-- Status realmente terminais continuam bloqueados: concluida, aprovada, reprovada, aprovada_ressalvas.
--
-- Motivação: a UI (ServicoDetailModal) já oferece o botão "Realocar" para serviços em
-- 'cancelada' (incluindo os auto-cancelados pelo backfill de "serviço fantasma"), mas
-- a RPC atual recusa todos os 'cancelada' como terminais. Resultado: serviço fica preso
-- para sempre. Esta versão trata 'cancelada' como reabertura controlada com auditoria.

CREATE OR REPLACE FUNCTION public.realocar_servico(
  _servico_id uuid,
  _motivo text,
  _destino text,
  _categoria text DEFAULT 'outro_motivo'::text,
  _nova_data date DEFAULT NULL::date,
  _novo_periodo text DEFAULT 'manha'::text,
  _profissional_id uuid DEFAULT NULL::uuid,
  _rota_id uuid DEFAULT NULL::uuid,
  _oficina_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _autorizado boolean := false;
  _servico record;
  _associado record;
  _veiculo record;
  _oficina text;
  _data_alvo date := COALESCE(_nova_data, CURRENT_DATE);
  _periodo_alvo text := COALESCE(_novo_periodo, 'manha');
  _profissional_final uuid;
  _rota_final uuid;
  _local_vistoria text;
  _acao_historico text;
  _tipo_log text;
  _agendamentos_fechados int := 0;
  _reabertura boolean := false;
  _categoria_final text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _motivo IS NULL OR length(trim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo é obrigatório (mínimo 5 caracteres)';
  END IF;

  IF _destino NOT IN ('fila','profissional','rota','base') THEN
    RAISE EXCEPTION 'Destino inválido: % (use fila|profissional|rota|base)', _destino;
  END IF;

  IF _periodo_alvo NOT IN ('manha','tarde') THEN
    RAISE EXCEPTION 'Período inválido: % (use manha ou tarde)', _periodo_alvo;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('diretor','admin_master','desenvolvedor','coordenador_monitoramento','analista_monitoramento')
  ) INTO _autorizado;

  IF NOT _autorizado THEN
    RAISE EXCEPTION 'Sem permissão para realocar serviço';
  END IF;

  SELECT id, status, profissional_id, instalacao_origem_id, vistoria_origem_id,
         data_agendada, periodo, associado_id, veiculo_id, tipo
  INTO _servico
  FROM public.servicos
  WHERE id = _servico_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado';
  END IF;

  -- Status realmente terminais (resultado de execução): bloqueados.
  IF _servico.status IN ('concluida','aprovada','reprovada','aprovada_ressalvas') THEN
    RAISE EXCEPTION 'Serviço em status terminal (%) não pode ser realocado', _servico.status;
  END IF;

  -- 'cancelada' é tratado como REABERTURA CONTROLADA (não terminal real).
  IF _servico.status = 'cancelada' THEN
    _reabertura := true;
  END IF;

  _categoria_final := CASE WHEN _reabertura
                           THEN 'reabertura_pos_cancelamento'
                           ELSE _categoria
                      END;

  CASE _destino
    WHEN 'fila' THEN
      _profissional_final := NULL;
      _rota_final := NULL;
      _local_vistoria := NULL;
      _acao_historico := CASE WHEN _reabertura THEN 'reaberta_fila' ELSE 'devolvida_fila' END;
      _tipo_log := CASE WHEN _reabertura THEN 'reabertura_fila' ELSE 'devolucao_fila' END;
    WHEN 'profissional' THEN
      IF _profissional_id IS NULL THEN
        RAISE EXCEPTION 'Profissional é obrigatório para destino=profissional';
      END IF;
      _profissional_final := _profissional_id;
      _rota_final := NULL;
      _local_vistoria := NULL;
      _acao_historico := CASE WHEN _reabertura THEN 'reaberta_profissional' ELSE 'reatribuida_profissional' END;
      _tipo_log := CASE WHEN _reabertura THEN 'reabertura_profissional' ELSE 'reatribuicao_admin' END;
    WHEN 'rota' THEN
      IF _rota_id IS NULL THEN
        RAISE EXCEPTION 'Rota é obrigatória para destino=rota';
      END IF;
      SELECT instalador_id INTO _profissional_final
      FROM public.rotas WHERE id = _rota_id;
      _rota_final := _rota_id;
      _local_vistoria := NULL;
      _acao_historico := CASE WHEN _reabertura THEN 'reaberta_rota' ELSE 'realocada_rota' END;
      _tipo_log := CASE WHEN _reabertura THEN 'reabertura_rota' ELSE 'realocacao_rota' END;
    WHEN 'base' THEN
      IF _oficina_id IS NULL THEN
        RAISE EXCEPTION 'Oficina é obrigatória para destino=base';
      END IF;
      _profissional_final := NULL;
      _rota_final := NULL;
      _local_vistoria := 'base';
      _acao_historico := CASE WHEN _reabertura THEN 'reaberta_base' ELSE 'realocada_base' END;
      _tipo_log := CASE WHEN _reabertura THEN 'reabertura_base' ELSE 'realocacao_base' END;
  END CASE;

  -- 1) servicos: sempre 'agendada' (canônico de fila/atribuição)
  UPDATE public.servicos
  SET
    profissional_id = _profissional_final,
    rota_id = _rota_final,
    status = 'agendada'::status_servico,
    data_agendada = _data_alvo,
    periodo = _periodo_alvo::periodo_servico,
    hora_agendada = NULL,
    local_vistoria = _local_vistoria,
    iniciada_em = NULL,
    em_rota_em = NULL,
    confirmacao_whatsapp = NULL,
    data_agendada_original = COALESCE(data_agendada_original, _servico.data_agendada),
    observacoes = COALESCE(NULLIF(observacoes,''), '') ||
      CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
      '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
      CASE WHEN _reabertura THEN '] REABERTO->' ELSE '] REALOCADO->' END
      || upper(_destino) || ' (' || _categoria_final || ') por ' || _uid::text ||
      ' — nova data: ' || to_char(_data_alvo,'DD/MM/YYYY') || ' ' || _periodo_alvo ||
      ' · Motivo: ' || _motivo,
    updated_at = now()
  WHERE id = _servico_id;

  -- 2) instalacoes vinculadas — reabre 'cancelada' quando _reabertura=true
  IF _servico.instalacao_origem_id IS NOT NULL THEN
    UPDATE public.instalacoes
    SET
      instalador_responsavel_id = _profissional_final,
      vistoriador_prestador_id = NULL,
      rota_id = _rota_final,
      status = 'agendada'::status_instalacao,
      data_agendada = _data_alvo,
      periodo = _periodo_alvo::periodo_instalacao,
      hora_agendada = NULL,
      iniciada_em = NULL,
      em_rota_em = NULL,
      data_agendada_original = COALESCE(data_agendada_original, _servico.data_agendada),
      updated_at = now()
    WHERE id = _servico.instalacao_origem_id
      AND (
        status NOT IN ('concluida','cancelada')
        OR (_reabertura AND status = 'cancelada')
      );
  END IF;

  -- 3) vistorias vinculadas
  IF _servico.vistoria_origem_id IS NOT NULL THEN
    UPDATE public.vistorias
    SET
      data_agendada = _data_alvo,
      hora_agendada = NULL,
      updated_at = now()
    WHERE id = _servico.vistoria_origem_id;
  END IF;

  -- 4) agendamentos_base — fechar antigos
  IF _servico.instalacao_origem_id IS NOT NULL THEN
    UPDATE public.agendamentos_base
    SET status = 'cancelada',
        updated_at = now(),
        observacoes = COALESCE(NULLIF(observacoes,''), '') ||
          CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
          '[Realocado->' || _destino || ' — ' || _categoria_final || '] ' || _motivo
    WHERE instalacao_id = _servico.instalacao_origem_id
      AND status NOT IN ('cancelada','concluida','aprovada','reprovada');
    GET DIAGNOSTICS _agendamentos_fechados = ROW_COUNT;
  END IF;

  -- 4b) destino base → criar novo agendamento
  IF _destino = 'base' AND _servico.instalacao_origem_id IS NOT NULL THEN
    SELECT * INTO _associado FROM public.associados WHERE id = _servico.associado_id;
    SELECT * INTO _veiculo FROM public.veiculos WHERE id = _servico.veiculo_id;

    SELECT COALESCE(NULLIF(trim(nome_fantasia), ''), razao_social)
    INTO _oficina
    FROM public.oficinas
    WHERE id = _oficina_id;

    IF _oficina IS NULL THEN
      RAISE EXCEPTION 'Oficina/base % não encontrada', _oficina_id;
    END IF;

    INSERT INTO public.agendamentos_base (
      instalacao_id, oficina_id, data_agendada, horario,
      cliente_nome, cliente_telefone, veiculo_placa, veiculo_descricao,
      status, observacoes
    ) VALUES (
      _servico.instalacao_origem_id,
      _oficina_id,
      _data_alvo,
      CASE WHEN _periodo_alvo = 'manha' THEN '09:00'::time ELSE '14:00'::time END,
      COALESCE(_associado.nome,'Cliente'),
      _associado.telefone,
      _veiculo.placa,
      trim(COALESCE(_veiculo.marca,'') || ' ' || COALESCE(_veiculo.modelo,'') || ' ' || COALESCE(_veiculo.ano_modelo::text,'')),
      'agendado',
      'Realocada para base ' || _oficina || '. Motivo: ' || _motivo
    );
  END IF;

  -- 5) Log de atribuição
  BEGIN
    INSERT INTO public.servicos_atribuicoes_log (
      servico_id, profissional_id, tipo_atribuicao, atribuido_por, observacoes
    ) VALUES (
      _servico_id, _profissional_final, _tipo_log, _uid,
      CASE WHEN _reabertura THEN '[REABERTURA pós-cancelamento] ' || _motivo ELSE _motivo END
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 6) Histórico do associado
  BEGIN
    IF _servico.associado_id IS NOT NULL THEN
      INSERT INTO public.associados_historico (
        associado_id, acao, descricao, metadata, criado_por
      ) VALUES (
        _servico.associado_id,
        _acao_historico,
        CASE WHEN _reabertura
             THEN 'Serviço REABERTO (' || _destino || ') — ' || _categoria_final || ': ' || _motivo
             ELSE 'Serviço realocado (' || _destino || ') — ' || _categoria_final || ': ' || _motivo
        END,
        jsonb_build_object(
          'servico_id', _servico_id,
          'destino', _destino,
          'categoria', _categoria_final,
          'reabertura', _reabertura,
          'status_anterior', _servico.status,
          'profissional_anterior', _servico.profissional_id,
          'profissional_novo', _profissional_final,
          'rota_nova', _rota_final,
          'oficina_nova', _oficina_id,
          'oficina_nome', _oficina,
          'data_anterior', _servico.data_agendada,
          'data_nova', _data_alvo,
          'periodo_anterior', _servico.periodo,
          'periodo_novo', _periodo_alvo,
          'motivo', _motivo
        ),
        _uid
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'servico_id', _servico_id,
    'destino', _destino,
    'reabertura', _reabertura,
    'profissional_anterior', _servico.profissional_id,
    'profissional_novo', _profissional_final,
    'rota_nova', _rota_final,
    'oficina_nova', _oficina_id,
    'oficina_nome', _oficina,
    'nova_data', _data_alvo,
    'novo_periodo', _periodo_alvo,
    'agendamentos_fechados', _agendamentos_fechados,
    'instalacao_id', _servico.instalacao_origem_id,
    'vistoria_id', _servico.vistoria_origem_id,
    'associado_id', _servico.associado_id,
    'veiculo_id', _servico.veiculo_id,
    'associado_nome', (SELECT nome FROM public.associados WHERE id = _servico.associado_id),
    'associado_telefone', (SELECT telefone FROM public.associados WHERE id = _servico.associado_id),
    'veiculo_placa', (SELECT placa FROM public.veiculos WHERE id = _servico.veiculo_id)
  );
END;
$function$;
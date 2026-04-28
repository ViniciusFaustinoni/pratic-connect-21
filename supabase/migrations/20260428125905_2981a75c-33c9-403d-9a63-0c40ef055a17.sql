-- =========================================================================
-- RPC UNIFICADA: realocar_servico
-- Substitui (e absorve) liberar_servico_para_reatribuicao + reatribuir_servico_admin
-- Cobre 4 destinos: 'fila' | 'profissional' | 'rota' | 'base'
-- =========================================================================
CREATE OR REPLACE FUNCTION public.realocar_servico(
  _servico_id uuid,
  _motivo text,
  _destino text,                          -- 'fila' | 'profissional' | 'rota' | 'base'
  _categoria text DEFAULT 'reagendamento_operacional',
  _nova_data date DEFAULT NULL,
  _novo_periodo text DEFAULT 'manha',
  _profissional_id uuid DEFAULT NULL,
  _rota_id uuid DEFAULT NULL,
  _oficina_id uuid DEFAULT NULL
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
  _oficina record;
  _data_alvo date := COALESCE(_nova_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  _periodo_alvo text := COALESCE(_novo_periodo, 'manha');
  _agendamentos_fechados int := 0;
  _acao_historico text;
  _tipo_log text;
  _local_vistoria text;
  _profissional_final uuid;
  _rota_final uuid;
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

  IF _categoria NOT IN ('nao_compareceu','tecnico_indisponivel','reagendamento_operacional','outro') THEN
    RAISE EXCEPTION 'Categoria inválida: %', _categoria;
  END IF;

  IF _periodo_alvo NOT IN ('manha','tarde') THEN
    RAISE EXCEPTION 'Período inválido: % (use manha ou tarde)', _periodo_alvo;
  END IF;

  IF _destino = 'profissional' AND _profissional_id IS NULL THEN
    RAISE EXCEPTION 'Destino profissional exige _profissional_id';
  END IF;
  IF _destino = 'base' AND _oficina_id IS NULL THEN
    RAISE EXCEPTION 'Destino base exige _oficina_id';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('diretor','admin_master','desenvolvedor','coordenador_monitoramento','analista_monitoramento')
  ) INTO _autorizado;

  IF NOT _autorizado THEN
    RAISE EXCEPTION 'Sem permissão para realocar serviço';
  END IF;

  SELECT id, status, profissional_id, rota_id, instalacao_origem_id, vistoria_origem_id,
         data_agendada, periodo, associado_id, veiculo_id, tipo
  INTO _servico
  FROM public.servicos
  WHERE id = _servico_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado';
  END IF;

  IF _servico.status IN ('concluida','aprovada','reprovada','aprovada_ressalvas','cancelada') THEN
    RAISE EXCEPTION 'Serviço em status terminal (%) — não pode ser realocado.', _servico.status;
  END IF;

  -- Buscar dados do associado e veículo (para retorno e WhatsApp)
  SELECT nome, telefone INTO _associado FROM public.associados WHERE id = _servico.associado_id;
  SELECT placa, marca, modelo, ano_modelo INTO _veiculo FROM public.veiculos WHERE id = _servico.veiculo_id;

  -- Resolver profissional/rota/local conforme destino
  CASE _destino
    WHEN 'fila' THEN
      _profissional_final := NULL;
      _rota_final := NULL;
      _local_vistoria := 'cliente';
      _acao_historico := 'realocada_fila';
      _tipo_log := 'liberacao_para_fila';
    WHEN 'profissional' THEN
      _profissional_final := _profissional_id;
      _rota_final := NULL;
      _local_vistoria := 'cliente';
      _acao_historico := 'realocada_profissional';
      _tipo_log := 'reatribuicao_manual';
    WHEN 'rota' THEN
      _profissional_final := COALESCE(
        _profissional_id,
        (SELECT instalador_id FROM public.rotas WHERE id = _rota_id)
      );
      _rota_final := _rota_id;
      _local_vistoria := 'cliente';
      _acao_historico := 'realocada_rota';
      _tipo_log := 'realocacao_rota';
    WHEN 'base' THEN
      _profissional_final := NULL;
      _rota_final := NULL;
      _local_vistoria := 'base';
      _acao_historico := 'realocada_base';
      _tipo_log := 'realocacao_base';
  END CASE;

  -- 1) servicos
  UPDATE public.servicos
  SET
    profissional_id = _profissional_final,
    rota_id = _rota_final,
    status = 'agendada'::status_servico,
    data_agendada = _data_alvo,
    periodo = _periodo_alvo::periodo_atendimento,
    hora_agendada = NULL,
    local_vistoria = _local_vistoria,
    iniciada_em = NULL,
    em_rota_em = NULL,
    confirmacao_whatsapp = NULL,
    data_agendada_original = COALESCE(data_agendada_original, _servico.data_agendada),
    observacoes = COALESCE(NULLIF(observacoes,''), '') ||
      CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
      '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
      '] REALOCADO->' || upper(_destino) || ' (' || _categoria || ') por ' || _uid::text ||
      ' — nova data: ' || to_char(_data_alvo,'DD/MM/YYYY') || ' ' || _periodo_alvo ||
      ' · Motivo: ' || _motivo,
    updated_at = now()
  WHERE id = _servico_id;

  -- 2) instalacoes vinculadas
  IF _servico.instalacao_origem_id IS NOT NULL THEN
    UPDATE public.instalacoes
    SET
      instalador_responsavel_id = _profissional_final,
      vistoriador_prestador_id = NULL,
      rota_id = _rota_final,
      status = CASE WHEN _profissional_final IS NULL THEN 'pendente'::status_instalacao
                    ELSE 'agendada'::status_instalacao END,
      data_agendada = _data_alvo,
      periodo = _periodo_alvo::periodo_atendimento,
      hora_agendada = NULL,
      iniciada_em = NULL,
      em_rota_em = NULL,
      data_agendada_original = COALESCE(data_agendada_original, _servico.data_agendada),
      updated_at = now()
    WHERE id = _servico.instalacao_origem_id
      AND status NOT IN ('concluida','cancelada');
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

  -- 4) agendamentos_base — fechar antigos sempre
  IF _servico.instalacao_origem_id IS NOT NULL THEN
    UPDATE public.agendamentos_base
    SET status = 'cancelada',
        updated_at = now(),
        observacoes = COALESCE(NULLIF(observacoes,''), '') ||
          CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
          '[Realocado->' || _destino || ' — ' || _categoria || '] ' || _motivo
    WHERE instalacao_id = _servico.instalacao_origem_id
      AND status NOT IN ('cancelada','concluida','aprovada','reprovada');
    GET DIAGNOSTICS _agendamentos_fechados = ROW_COUNT;
  END IF;

  -- 4b) Se destino = base, criar novo agendamento_base
  IF _destino = 'base' AND _servico.instalacao_origem_id IS NOT NULL THEN
    SELECT nome INTO _oficina FROM public.oficinas_credenciadas WHERE id = _oficina_id;

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
      'confirmado',
      'Realocada para base. Motivo: ' || _motivo
    );
  END IF;

  -- 5) Log de atribuição
  BEGIN
    INSERT INTO public.servicos_atribuicoes_log (
      servico_id, profissional_id, tipo_atribuicao, atribuido_por, observacoes
    ) VALUES (
      _servico_id,
      _profissional_final,
      _tipo_log,
      _uid,
      'Realocação->' || _destino || ' — ' || _categoria || ' — ' || _motivo
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 6) Histórico do associado
  IF _servico.associado_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.associados_historico (
        associado_id, instalacao_id, tipo, acao, descricao, motivo,
        status_anterior, status_novo, dados_novos, usuario_id, executado_por
      ) VALUES (
        _servico.associado_id,
        _servico.instalacao_origem_id,
        'status_alterado',
        _acao_historico,
        'Serviço realocado (' || _destino || ' / ' || _categoria || ')',
        _motivo,
        _servico.status::text,
        'agendada',
        jsonb_build_object(
          'destino', _destino,
          'categoria', _categoria,
          'data_anterior', _servico.data_agendada,
          'periodo_anterior', _servico.periodo,
          'nova_data', _data_alvo,
          'novo_periodo', _periodo_alvo,
          'profissional_anterior', _servico.profissional_id,
          'profissional_novo', _profissional_final,
          'rota_anterior', _servico.rota_id,
          'rota_nova', _rota_final,
          'oficina_id', _oficina_id
        ),
        _uid,
        _uid
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'servico_id', _servico_id,
    'destino', _destino,
    'profissional_anterior', _servico.profissional_id,
    'profissional_novo', _profissional_final,
    'rota_nova', _rota_final,
    'oficina_id', _oficina_id,
    'oficina_nome', _oficina.nome,
    'nova_data', _data_alvo,
    'novo_periodo', _periodo_alvo,
    'agendamentos_fechados', _agendamentos_fechados,
    'associado_nome', _associado.nome,
    'associado_telefone', _associado.telefone,
    'veiculo_placa', _veiculo.placa
  );
END;
$function$;

-- =========================================================================
-- WRAPPERS DE COMPATIBILIDADE — chamam realocar_servico internamente
-- =========================================================================
CREATE OR REPLACE FUNCTION public.liberar_servico_para_reatribuicao(
  _servico_id uuid,
  _motivo text,
  _categoria text DEFAULT 'nao_compareceu',
  _nova_data date DEFAULT NULL,
  _novo_periodo text DEFAULT 'manha'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.realocar_servico(
    _servico_id := _servico_id,
    _motivo := _motivo,
    _destino := 'fila',
    _categoria := _categoria,
    _nova_data := _nova_data,
    _novo_periodo := _novo_periodo
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reatribuir_servico_admin(
  _servico_id uuid,
  _novo_profissional_id uuid,
  _motivo text,
  _categoria text DEFAULT 'tecnico_indisponivel',
  _nova_data date DEFAULT NULL,
  _novo_periodo text DEFAULT 'manha'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.realocar_servico(
    _servico_id := _servico_id,
    _motivo := _motivo,
    _destino := 'profissional',
    _categoria := _categoria,
    _nova_data := _nova_data,
    _novo_periodo := _novo_periodo,
    _profissional_id := _novo_profissional_id
  );
END;
$function$;
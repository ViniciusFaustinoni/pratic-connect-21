-- =========================================================================
-- RPC 1: liberar_servico_para_reatribuicao
-- Devolve um serviço atribuído à fila de atribuição manual SEM cancelá-lo.
-- Mantém a instalação/vistoria viva, apenas zera o profissional e reagenda.
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
DECLARE
  _uid uuid := auth.uid();
  _autorizado boolean := false;
  _servico record;
  _data_alvo date := COALESCE(_nova_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  _periodo_alvo text := COALESCE(_novo_periodo, 'manha');
  _agendamentos_fechados int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _motivo IS NULL OR length(trim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo é obrigatório (mínimo 5 caracteres)';
  END IF;

  IF _categoria NOT IN ('nao_compareceu', 'tecnico_indisponivel', 'reagendamento_operacional', 'outro') THEN
    RAISE EXCEPTION 'Categoria inválida: %', _categoria;
  END IF;

  IF _periodo_alvo NOT IN ('manha', 'tarde') THEN
    RAISE EXCEPTION 'Período inválido: % (use manha ou tarde)', _periodo_alvo;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('diretor','admin_master','desenvolvedor','coordenador_monitoramento','analista_monitoramento')
  ) INTO _autorizado;

  IF NOT _autorizado THEN
    RAISE EXCEPTION 'Sem permissão para devolver serviço à fila';
  END IF;

  SELECT id, status, profissional_id, instalacao_origem_id, vistoria_origem_id,
         data_agendada, periodo, associado_id
  INTO _servico
  FROM public.servicos
  WHERE id = _servico_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado';
  END IF;

  IF _servico.status IN ('concluida','aprovada','reprovada','aprovada_ressalvas','cancelada') THEN
    RAISE EXCEPTION 'Serviço em status terminal (%) — use realocar/reagendar a partir do registro original.', _servico.status;
  END IF;

  -- 1) servicos: zera atribuição, mantém ativo, aplica nova data/período
  UPDATE public.servicos
  SET
    profissional_id = NULL,
    rota_id = NULL,
    status = 'agendada'::status_servico,
    data_agendada = _data_alvo,
    periodo = _periodo_alvo::periodo_atendimento,
    hora_agendada = NULL,
    iniciada_em = NULL,
    em_rota_em = NULL,
    confirmacao_whatsapp = NULL,
    data_agendada_original = COALESCE(data_agendada_original, _servico.data_agendada),
    observacoes = COALESCE(NULLIF(observacoes,''), '') ||
      CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
      '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
      '] DEVOLVIDO À FILA (' || _categoria || ') por ' || _uid::text ||
      ' — nova data: ' || to_char(_data_alvo,'DD/MM/YYYY') || ' ' || _periodo_alvo ||
      ' · Motivo: ' || _motivo,
    updated_at = now()
  WHERE id = _servico_id;

  -- 2) Sincroniza instalações vinculadas (origem do serviço)
  IF _servico.instalacao_origem_id IS NOT NULL THEN
    UPDATE public.instalacoes
    SET
      instalador_responsavel_id = NULL,
      vistoriador_prestador_id = NULL,
      rota_id = NULL,
      status = 'pendente'::status_instalacao,
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

  -- 3) Sincroniza vistorias vinculadas (origem do serviço)
  IF _servico.vistoria_origem_id IS NOT NULL THEN
    UPDATE public.vistorias
    SET
      data_agendada = _data_alvo,
      hora_agendada = NULL,
      updated_at = now()
    WHERE id = _servico.vistoria_origem_id;
  END IF;

  -- 4) Fecha agendamentos_base ativos da mesma instalação (regra: 1 origem = 1 agendamento ativo)
  IF _servico.instalacao_origem_id IS NOT NULL THEN
    UPDATE public.agendamentos_base
    SET status = 'cancelada',
        updated_at = now(),
        observacoes = COALESCE(NULLIF(observacoes,''), '') ||
          CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
          '[Devolvido à fila — ' || _categoria || '] ' || _motivo
    WHERE instalacao_id = _servico.instalacao_origem_id
      AND status NOT IN ('cancelada','concluida','aprovada','reprovada');
    GET DIAGNOSTICS _agendamentos_fechados = ROW_COUNT;
  END IF;

  -- 5) Log de atribuição (tipo: liberacao_para_fila)
  BEGIN
    INSERT INTO public.servicos_atribuicoes_log (
      servico_id, profissional_id, tipo_atribuicao, atribuido_por, observacoes
    ) VALUES (
      _servico_id,
      _servico.profissional_id,
      'liberacao_para_fila',
      _uid,
      'Devolução à fila — ' || _categoria || ' — ' || _motivo
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
        'devolvida_fila',
        'Serviço devolvido à fila de atribuição manual (' || _categoria || ')',
        _motivo,
        _servico.status::text,
        'agendada',
        jsonb_build_object(
          'categoria', _categoria,
          'data_anterior', _servico.data_agendada,
          'periodo_anterior', _servico.periodo,
          'nova_data', _data_alvo,
          'novo_periodo', _periodo_alvo,
          'profissional_anterior', _servico.profissional_id
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
    'profissional_anterior', _servico.profissional_id,
    'nova_data', _data_alvo,
    'novo_periodo', _periodo_alvo,
    'agendamentos_fechados', _agendamentos_fechados
  );
END;
$function$;

-- =========================================================================
-- RPC 2: reatribuir_servico_admin
-- Devolve à fila e em seguida atribui ao novo profissional, atomicamente.
-- =========================================================================
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
DECLARE
  _uid uuid := auth.uid();
  _resultado jsonb;
  _data_alvo date;
  _periodo_alvo text;
BEGIN
  -- 1) Libera (já valida permissão e motivo)
  _resultado := public.liberar_servico_para_reatribuicao(
    _servico_id, _motivo, _categoria, _nova_data, _novo_periodo
  );

  _data_alvo := (_resultado->>'nova_data')::date;
  _periodo_alvo := _resultado->>'novo_periodo';

  -- 2) Atribui ao novo profissional
  UPDATE public.servicos
  SET profissional_id = _novo_profissional_id,
      status = 'agendada'::status_servico,
      updated_at = now()
  WHERE id = _servico_id;

  -- 3) Log
  BEGIN
    INSERT INTO public.servicos_atribuicoes_log (
      servico_id, profissional_id, tipo_atribuicao, atribuido_por, observacoes
    ) VALUES (
      _servico_id,
      _novo_profissional_id,
      'reatribuicao_manual',
      _uid,
      'Reatribuição direta — ' || _categoria || ' — ' || _motivo
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN _resultado || jsonb_build_object(
    'novo_profissional_id', _novo_profissional_id,
    'reatribuido', true
  );
END;
$function$;
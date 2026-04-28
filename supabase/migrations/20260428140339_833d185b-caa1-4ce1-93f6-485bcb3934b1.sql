-- =============================================================================
-- 1) Corrigir realocar_servico: nunca usar 'em_analise' como estado de fila.
--    Quando devolver à fila / base, instalação volta para 'agendada' (sem
--    instalador). Isso mantém o serviço visível na fila manual e elegível
--    para atribuição automática.
-- =============================================================================
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

  IF _servico.status IN ('concluida','aprovada','reprovada','aprovada_ressalvas','cancelada') THEN
    RAISE EXCEPTION 'Serviço em status terminal (%) não pode ser realocado', _servico.status;
  END IF;

  CASE _destino
    WHEN 'fila' THEN
      _profissional_final := NULL;
      _rota_final := NULL;
      _local_vistoria := NULL;
      _acao_historico := 'devolvida_fila';
      _tipo_log := 'devolucao_fila';
    WHEN 'profissional' THEN
      IF _profissional_id IS NULL THEN
        RAISE EXCEPTION 'Profissional é obrigatório para destino=profissional';
      END IF;
      _profissional_final := _profissional_id;
      _rota_final := NULL;
      _local_vistoria := NULL;
      _acao_historico := 'reatribuida_profissional';
      _tipo_log := 'reatribuicao_admin';
    WHEN 'rota' THEN
      IF _rota_id IS NULL THEN
        RAISE EXCEPTION 'Rota é obrigatória para destino=rota';
      END IF;
      SELECT instalador_id INTO _profissional_final
      FROM public.rotas WHERE id = _rota_id;
      _rota_final := _rota_id;
      _local_vistoria := NULL;
      _acao_historico := 'realocada_rota';
      _tipo_log := 'realocacao_rota';
    WHEN 'base' THEN
      IF _oficina_id IS NULL THEN
        RAISE EXCEPTION 'Oficina é obrigatória para destino=base';
      END IF;
      _profissional_final := NULL;
      _rota_final := NULL;
      _local_vistoria := 'base';
      _acao_historico := 'realocada_base';
      _tipo_log := 'realocacao_base';
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
      '] REALOCADO->' || upper(_destino) || ' (' || _categoria || ') por ' || _uid::text ||
      ' — nova data: ' || to_char(_data_alvo,'DD/MM/YYYY') || ' ' || _periodo_alvo ||
      ' · Motivo: ' || _motivo,
    updated_at = now()
  WHERE id = _servico_id;

  -- 2) instalacoes vinculadas: SEMPRE 'agendada' (com ou sem instalador).
  --    'em_analise' deixa de ser usado como estado de fila operacional.
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

  -- 4) agendamentos_base — fechar antigos
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

  -- 4b) destino base → criar novo agendamento
  IF _destino = 'base' AND _servico.instalacao_origem_id IS NOT NULL THEN
    SELECT * INTO _associado FROM public.associados WHERE id = _servico.associado_id;
    SELECT * INTO _veiculo FROM public.veiculos WHERE id = _servico.veiculo_id;
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
      'agendado',
      'Realocada para base. Motivo: ' || _motivo
    );
  END IF;

  -- 5) Log de atribuição
  BEGIN
    INSERT INTO public.servicos_atribuicoes_log (
      servico_id, profissional_id, tipo_atribuicao, atribuido_por, observacoes
    ) VALUES (
      _servico_id, _profissional_final, _tipo_log, _uid, _motivo
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
        'Serviço realocado (' || _destino || ') — ' || _categoria || ': ' || _motivo,
        jsonb_build_object(
          'servico_id', _servico_id,
          'destino', _destino,
          'categoria', _categoria,
          'profissional_anterior', _servico.profissional_id,
          'profissional_novo', _profissional_final,
          'rota_nova', _rota_final,
          'oficina_nova', _oficina_id,
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
    'profissional_anterior', _servico.profissional_id,
    'profissional_novo', _profissional_final,
    'rota_nova', _rota_final,
    'oficina_nova', _oficina_id,
    'nova_data', _data_alvo,
    'novo_periodo', _periodo_alvo,
    'agendamentos_fechados', _agendamentos_fechados,
    'instalacao_id', _servico.instalacao_origem_id,
    'vistoria_id', _servico.vistoria_origem_id,
    'associado_id', _servico.associado_id,
    'veiculo_id', _servico.veiculo_id
  );
END;
$function$;

-- =============================================================================
-- 2) Blindar sincronização instalacao -> servicos.
--    Não propaga 'em_analise' para servicos (nunca tira da fila por efeito
--    colateral). 'em_analise' é estado interno da instalação (revisão); a
--    fila operacional do serviço usa apenas pendente/agendada.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_instalacao_update_to_servicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _new_status status_servico;
BEGIN
  -- Mapear status; se for 'em_analise', preservar status atual do serviço
  IF NEW.status::text = 'em_analise' THEN
    UPDATE public.servicos SET
      profissional_id = NEW.instalador_responsavel_id,
      data_agendada = NEW.data_agendada,
      hora_agendada = NEW.hora_agendada,
      logradouro = COALESCE(NEW.logradouro, servicos.logradouro),
      numero = COALESCE(NEW.numero, servicos.numero),
      bairro = COALESCE(NEW.bairro, servicos.bairro),
      cidade = COALESCE(NEW.cidade, servicos.cidade),
      uf = COALESCE(NEW.uf, servicos.uf),
      cep = COALESCE(NEW.cep, servicos.cep),
      latitude = COALESCE(NEW.endereco_latitude, servicos.latitude),
      longitude = COALESCE(NEW.endereco_longitude, servicos.longitude),
      updated_at = now()
    WHERE instalacao_origem_id = NEW.id
      AND status NOT IN ('em_rota','em_andamento','concluida','aprovada','reprovada','aprovada_ressalvas','cancelada');
    RETURN NEW;
  END IF;

  _new_status := public.map_to_status_servico(NEW.status::text);

  UPDATE public.servicos SET
    profissional_id = NEW.instalador_responsavel_id,
    data_agendada = NEW.data_agendada,
    hora_agendada = NEW.hora_agendada,
    status = _new_status,
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

-- =============================================================================
-- 3) View de auditoria para detectar futuros limbos
-- =============================================================================
CREATE OR REPLACE VIEW public.v_servicos_em_limbo_atribuicao AS
SELECT
  s.id AS servico_id,
  s.tipo,
  s.status::text AS status,
  s.data_agendada,
  s.periodo::text AS periodo,
  s.profissional_id,
  s.instalacao_origem_id,
  i.status::text AS instalacao_status,
  v.placa,
  a.nome AS associado_nome,
  s.updated_at
FROM public.servicos s
LEFT JOIN public.instalacoes i ON i.id = s.instalacao_origem_id
LEFT JOIN public.veiculos v ON v.id = s.veiculo_id
LEFT JOIN public.associados a ON a.id = s.associado_id
WHERE s.profissional_id IS NULL
  AND s.tipo = 'instalacao'
  AND s.status::text NOT IN (
    'pendente','agendada','reagendada','nao_compareceu',
    'concluida','aprovada','reprovada','aprovada_ressalvas','cancelada'
  );

GRANT SELECT ON public.v_servicos_em_limbo_atribuicao TO authenticated;

-- =============================================================================
-- 4) Backfill: restaurar serviços hoje em limbo (em_analise sem profissional)
--    LTG3H67, LTS3A98, 0KM91CD6 e quaisquer outros do mesmo padrão.
-- =============================================================================
DO $backfill$
DECLARE
  _r record;
BEGIN
  FOR _r IN
    SELECT s.id AS servico_id, s.instalacao_origem_id
    FROM public.servicos s
    WHERE s.tipo = 'instalacao'
      AND s.profissional_id IS NULL
      AND s.status::text = 'em_analise'
  LOOP
    -- Restaurar instalação para 'agendada' (sem instalador)
    IF _r.instalacao_origem_id IS NOT NULL THEN
      UPDATE public.instalacoes
      SET status = 'agendada'::status_instalacao,
          instalador_responsavel_id = NULL,
          updated_at = now()
      WHERE id = _r.instalacao_origem_id
        AND status NOT IN ('concluida','cancelada');
    END IF;

    -- Restaurar serviço para fila
    UPDATE public.servicos
    SET status = 'agendada'::status_servico,
        updated_at = now(),
        observacoes = COALESCE(NULLIF(observacoes,''),'') ||
          CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
          '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
          '] BACKFILL: restaurado para fila (estava em em_analise sem profissional)'
    WHERE id = _r.servico_id;

    -- Log
    BEGIN
      INSERT INTO public.servicos_atribuicoes_log (
        servico_id, profissional_id, tipo_atribuicao, atribuido_por, observacoes
      ) VALUES (
        _r.servico_id, NULL, 'devolucao_fila', NULL,
        'Backfill automático: serviço estava em em_analise sem profissional (restauração de regressão).'
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END;
$backfill$;
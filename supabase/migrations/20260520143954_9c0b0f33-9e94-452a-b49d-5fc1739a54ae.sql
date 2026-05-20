-- =====================================================================
-- Passo 3: Disjunção canônica entre Autovistoria e Serviço Presencial
-- =====================================================================
-- Causa raiz: dois materializadores competiam para o mesmo evento.
--   (1) Canônico: finalizar-autovistoria-cotacao / fn_materializar_autovistoria_cotacao
--   (2) Trigger antiga sync_vistoria_to_servicos criava um servico genérico
--       em paralelo (default modalidade='presencial'), driblando guards modernos.
-- Esta migration:
--   A) Neutraliza sync_vistoria_to_servicos APENAS quando vistoria é autovistoria.
--   B) Impede sync_instalacao_to_servicos de reaproveitar um servico de
--      autovistoria como se fosse uma instalação física.
--   C) Cria trg_guard_autovistoria_servico_disjunto para barrar, no DB, qualquer
--      tentativa de "operacionalizar" um servico de autovistoria (transições
--      inválidas, vínculo com instalacao_origem_id, etc.).
--
-- Outros tipos de vistoria (saida/sinistro/periódica/manutenção) seguem
-- inalterados pela trigger antiga — escopo Q1 confirmado pelo usuário.
-- =====================================================================

-- ───────────────────────────────────────────────────────────────────
-- (A) sync_vistoria_to_servicos: skip autovistoria
-- ───────────────────────────────────────────────────────────────────
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
  -- Q1 (canônico): autovistoria é materializada exclusivamente por
  -- finalizar-autovistoria-cotacao / fn_materializar_autovistoria_cotacao.
  -- Esta trigger antiga NÃO deve criar servico paralelo "presencial".
  IF NEW.modalidade IS NOT NULL AND NEW.modalidade::text = 'autovistoria' THEN
    RETURN NEW;
  END IF;

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
       AND COALESCE(modalidade::text, 'presencial') <> 'autovistoria'
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
    SELECT status INTO v_current_status
      FROM public.servicos WHERE vistoria_origem_id = NEW.id LIMIT 1;

    v_new_status := COALESCE(NEW.status::text::status_servico, v_current_status);

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

    IF v_current_status::text IN ('em_andamento','em_analise','em_rota')
       AND v_new_status::text IN ('agendada','reagendada') THEN
      v_new_status := v_current_status;
    END IF;

    UPDATE public.servicos SET
      status = v_new_status,
      data_agendada = v_data,
      hora_agendada = v_hora,
      periodo = v_periodo,
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

-- ───────────────────────────────────────────────────────────────────
-- (B) sync_instalacao_to_servicos: nunca reaproveitar servico de autovistoria
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_instalacao_to_servicos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.servicos
  WHERE instalacao_origem_id = NEW.id
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.contrato_id IS NOT NULL AND NEW.veiculo_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.servicos
    WHERE instalacao_origem_id IS NULL
      AND contrato_id = NEW.contrato_id
      AND veiculo_id = NEW.veiculo_id
      AND tipo IN ('instalacao','vistoria_entrada')
      AND status NOT IN ('cancelada','reprovada','concluida','aprovada','aprovada_ressalvas')
      -- Q1 (canônico): NUNCA reaproveitar servico de autovistoria como instalacao física.
      -- A autovistoria é artefato terminal; instalação presencial é evento físico distinto.
      AND COALESCE(modalidade::text, 'presencial') <> 'autovistoria'
      AND COALESCE(origem, '') <> 'autovistoria_publica'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.servicos
      SET instalacao_origem_id = NEW.id,
          data_agendada = COALESCE(NEW.data_agendada, data_agendada),
          hora_agendada = COALESCE(NEW.hora_agendada, hora_agendada),
          periodo       = COALESCE((NEW.periodo::text)::periodo_servico, periodo),
          updated_at = now()
      WHERE id = v_existing_id;
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.servicos (
    tipo, status, data_agendada, hora_agendada, periodo,
    associado_id, veiculo_id, latitude, longitude,
    logradouro, numero, bairro, cidade, uf, cep,
    permite_encaixe, local_vistoria, cotacao_id, contrato_id,
    instalacao_origem_id, origem, created_at, updated_at
  ) VALUES (
    'instalacao', (NEW.status::text)::status_servico, NEW.data_agendada, NEW.hora_agendada,
    (NEW.periodo::text)::periodo_servico, NEW.associado_id, NEW.veiculo_id,
    NEW.endereco_latitude, NEW.endereco_longitude,
    NEW.logradouro, NEW.numero, NEW.bairro, NEW.cidade, NEW.uf, NEW.cep,
    COALESCE(NEW.permite_encaixe, false), COALESCE(NEW.local_vistoria, 'cliente'),
    NEW.cotacao_id, NEW.contrato_id, NEW.id, 'instalacao', NOW(), NOW()
  );
  RETURN NEW;
END;
$function$;

-- ───────────────────────────────────────────────────────────────────
-- (C) Guard: servico de autovistoria é DISJUNTO de operação presencial
-- ───────────────────────────────────────────────────────────────────
-- Q2 (canônico): autovistoria só pode transitar em
--   em_analise → aprovada | reprovada | cancelada
-- e NUNCA recebe instalacao_origem_id.
CREATE OR REPLACE FUNCTION public.fn_guard_autovistoria_servico_disjunto()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_allowed_status text[] := ARRAY['em_analise','aprovada','reprovada','cancelada'];
BEGIN
  IF COALESCE(NEW.modalidade::text, '') <> 'autovistoria' THEN
    RETURN NEW;
  END IF;

  -- Bloqueia vínculo com instalação física
  IF NEW.instalacao_origem_id IS NOT NULL THEN
    RAISE EXCEPTION 'servico_autovistoria_nao_aceita_instalacao_origem'
      USING HINT = 'Serviço de autovistoria é artefato terminal; instalação presencial deve ser servico separado.';
  END IF;

  -- Bloqueia transições operacionais (agendada/em_rota/em_andamento/concluida/reagendada/nao_compareceu/aprovada_ressalvas)
  IF NEW.status::text <> ALL (v_allowed_status) THEN
    RAISE EXCEPTION 'servico_autovistoria_status_invalido: % (permitidos: %)',
      NEW.status::text, array_to_string(v_allowed_status, ', ')
      USING HINT = 'Autovistoria só permite em_analise → aprovada/reprovada/cancelada.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_autovistoria_servico_disjunto ON public.servicos;
CREATE TRIGGER trg_guard_autovistoria_servico_disjunto
  BEFORE INSERT OR UPDATE ON public.servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_autovistoria_servico_disjunto();

COMMENT ON FUNCTION public.fn_guard_autovistoria_servico_disjunto() IS
'Disjunção canônica autovistoria vs presencial: bloqueia instalacao_origem_id e transições operacionais em servicos com modalidade=autovistoria. Ver mem://logic/operations/autovistoria-vs-servico-presencial-disjuntos.';
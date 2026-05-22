
-- =========================================================================
-- Item 5: Fechamento automático da vistoria presencial quando o vídeo 360°
-- é anexado. Faz o caso aparecer na fila do Monitoramento sem ação manual,
-- igual ao caminho do prestador.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fn_vistoria_video_360_promove_concluida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Dispara apenas quando o vídeo 360° passa de NULL para não-NULL.
  IF NEW.video_360_url IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.video_360_url IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Apenas vistoria presencial (técnico próprio / base / rota / fit).
  -- Autovistoria e prestador têm caminhos próprios de fechamento.
  IF COALESCE(NEW.modalidade::text, '') = 'autovistoria' THEN
    RETURN NEW;
  END IF;

  -- Já em estado terminal? Não mexer.
  IF NEW.status::text IN ('concluida','aprovada','reprovada','aprovada_ressalvas','cancelada') THEN
    RETURN NEW;
  END IF;

  BEGIN
    UPDATE public.vistorias
       SET status = 'concluida'::status_vistoria,
           concluida_em = COALESCE(concluida_em, now()),
           updated_at = now()
     WHERE id = NEW.id
       AND status::text NOT IN ('concluida','aprovada','reprovada','aprovada_ressalvas','cancelada');

    -- Marcar contrato.vistoria_concluida_em (não tocar cadastro_aprovado).
    IF NEW.contrato_id IS NOT NULL THEN
      UPDATE public.contratos
         SET vistoria_concluida_em = COALESCE(vistoria_concluida_em, now()),
             updated_at = now()
       WHERE id = NEW.contrato_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Não bloquear o UPDATE original do video_360_url.
    RAISE WARNING '[trg_vistoria_video_360_promove_concluida] Falhou para %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vistoria_video_360_promove_concluida ON public.vistorias;
CREATE TRIGGER trg_vistoria_video_360_promove_concluida
AFTER UPDATE OF video_360_url ON public.vistorias
FOR EACH ROW
EXECUTE FUNCTION public.fn_vistoria_video_360_promove_concluida();


-- =========================================================================
-- Item 4: Rede de segurança — agendamento_base com vistoria/instalação
-- vinculada SEMPRE materializa o `servicos` correspondente.
-- Idempotente: só cria se ainda não existir vivo para a origem.
-- Complementa o trigger `sync_agendamento_base_to_vistoria` + cadeia normal.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fn_agendamento_base_materializa_servico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existente_id  uuid;
  v_associado_id  uuid;
  v_veiculo_id    uuid;
  v_contrato_id   uuid;
  v_cotacao_id    uuid;
  v_periodo       periodo_servico;
  v_hora          time;
  v_data          date;
  v_modalidade    text;
  v_vistoria_modalidade text;
BEGIN
  BEGIN
    -- Resolver período pelo horário do agendamento.
    v_hora := COALESCE(NEW.horario::time, '09:00:00'::time);
    v_periodo := CASE
      WHEN v_hora < '12:00:00'::time THEN 'manha'::periodo_servico
      WHEN v_hora < '18:00:00'::time THEN 'tarde'::periodo_servico
      ELSE 'noite'::periodo_servico
    END;
    v_data := COALESCE(NEW.data_agendada::date, CURRENT_DATE);

    -- Caso A: vistoria vinculada
    IF NEW.vistoria_id IS NOT NULL THEN
      -- Já existe servico vivo para essa vistoria? sai.
      SELECT id INTO v_existente_id
        FROM public.servicos
       WHERE vistoria_origem_id = NEW.vistoria_id
       LIMIT 1;
      IF v_existente_id IS NOT NULL THEN
        RETURN NEW;
      END IF;

      SELECT v.associado_id, v.veiculo_id, v.contrato_id, v.cotacao_id, v.modalidade::text
        INTO v_associado_id, v_veiculo_id, v_contrato_id, v_cotacao_id, v_vistoria_modalidade
        FROM public.vistorias v
       WHERE v.id = NEW.vistoria_id;

      -- Autovistoria é materializada pela edge canônica
      -- (finalizar-autovistoria-cotacao / fn_materializar_autovistoria_cotacao).
      IF COALESCE(v_vistoria_modalidade, '') = 'autovistoria' THEN
        RETURN NEW;
      END IF;

      IF v_associado_id IS NULL OR v_veiculo_id IS NULL THEN
        RETURN NEW;
      END IF;

      v_modalidade := COALESCE(v_vistoria_modalidade, 'presencial');

      INSERT INTO public.servicos (
        tipo, status, modalidade,
        data_agendada, hora_agendada, periodo,
        profissional_id, associado_id, veiculo_id, contrato_id, cotacao_id,
        vistoria_origem_id, local_vistoria,
        created_at, updated_at
      ) VALUES (
        'vistoria_entrada'::tipo_servico, 'agendada'::status_servico, v_modalidade,
        v_data, v_hora, v_periodo,
        NEW.atendido_por, v_associado_id, v_veiculo_id, v_contrato_id, v_cotacao_id,
        NEW.vistoria_id, 'base',
        now(), now()
      );
      RETURN NEW;
    END IF;

    -- Caso B: instalação vinculada
    IF NEW.instalacao_id IS NOT NULL THEN
      SELECT id INTO v_existente_id
        FROM public.servicos
       WHERE instalacao_origem_id = NEW.instalacao_id
       LIMIT 1;
      IF v_existente_id IS NOT NULL THEN
        RETURN NEW;
      END IF;

      SELECT i.associado_id, i.veiculo_id, i.contrato_id, i.cotacao_id
        INTO v_associado_id, v_veiculo_id, v_contrato_id, v_cotacao_id
        FROM public.instalacoes i
       WHERE i.id = NEW.instalacao_id;

      IF v_associado_id IS NULL OR v_veiculo_id IS NULL THEN
        RETURN NEW;
      END IF;

      INSERT INTO public.servicos (
        tipo, status, modalidade,
        data_agendada, hora_agendada, periodo,
        profissional_id, associado_id, veiculo_id, contrato_id, cotacao_id,
        instalacao_origem_id, local_vistoria,
        created_at, updated_at
      ) VALUES (
        'instalacao'::tipo_servico, 'agendada'::status_servico, 'presencial',
        v_data, v_hora, v_periodo,
        NEW.atendido_por, v_associado_id, v_veiculo_id, v_contrato_id, v_cotacao_id,
        NEW.instalacao_id, 'base',
        now(), now()
      );
      RETURN NEW;
    END IF;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[trg_agendamento_base_materializa_servico] Falhou para %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamento_base_materializa_servico ON public.agendamentos_base;
CREATE TRIGGER trg_agendamento_base_materializa_servico
AFTER INSERT OR UPDATE OF vistoria_id, instalacao_id ON public.agendamentos_base
FOR EACH ROW
EXECUTE FUNCTION public.fn_agendamento_base_materializa_servico();

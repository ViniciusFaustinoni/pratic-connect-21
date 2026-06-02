-- =====================================================================
-- Frente 1: promoção de vistorias.status quando o serviço é aprovado
-- =====================================================================
-- Hoje a aprovação do Monitoramento (useAprovacaoMonitoramento) faz
--   UPDATE servicos SET status='aprovada'
-- mas nada toca em vistorias.status, que fica preso em 'agendada'.
-- Triggers existentes só vão na direção oposta (vistoria → servico).
-- Esta migration adiciona o gatilho inverso.

CREATE OR REPLACE FUNCTION public.fn_sync_vistoria_on_servico_decisao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vistoria_id   uuid;
  v_novo_status   text;
BEGIN
  -- Só age quando o status do serviço muda para um estado terminal de decisão.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status::text NOT IN ('aprovada','aprovada_ressalvas','reprovada','cancelada') THEN
    RETURN NEW;
  END IF;

  -- Anti-recursão: se a propagação vier do trigger inverso
  -- (sync_servico_on_vistoria_decisao), evitar loop. Usamos uma GUC efêmera.
  IF current_setting('praticcar.in_vistoria_servico_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Mapeia status do serviço → status da vistoria.
  v_novo_status := CASE NEW.status::text
                     WHEN 'aprovada'           THEN 'aprovada'
                     WHEN 'aprovada_ressalvas' THEN 'aprovada_ressalvas'
                     WHEN 'reprovada'          THEN 'reprovada'
                     WHEN 'cancelada'          THEN 'cancelada'
                   END;

  -- Caminho A: vistoria diretamente vinculada
  v_vistoria_id := NEW.vistoria_origem_id;

  -- Caminho B: serviço materializado de uma instalação — vistoria fica em
  -- vistorias.instalacao_id (caso TTA5H86 / SSA3G29).
  IF v_vistoria_id IS NULL AND NEW.instalacao_origem_id IS NOT NULL THEN
    SELECT v.id INTO v_vistoria_id
      FROM public.vistorias v
     WHERE v.instalacao_id = NEW.instalacao_origem_id
       AND v.status::text NOT IN ('aprovada','aprovada_ressalvas','reprovada','cancelada')
     ORDER BY v.created_at DESC
     LIMIT 1;
  END IF;

  IF v_vistoria_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Marca a flag para o trigger inverso não rebater de volta.
  PERFORM set_config('praticcar.in_vistoria_servico_sync', 'on', true);

  BEGIN
    UPDATE public.vistorias
       SET status       = v_novo_status::status_vistoria,
           concluida_em = COALESCE(concluida_em, now()),
           updated_at   = now()
     WHERE id = v_vistoria_id
       -- Preserva vistorias já em estado terminal.
       AND status::text NOT IN ('aprovada','aprovada_ressalvas','reprovada','cancelada');
  EXCEPTION WHEN OTHERS THEN
    -- Não bloqueia a aprovação do serviço se o UPDATE falhar.
    RAISE WARNING '[fn_sync_vistoria_on_servico_decisao] servico=% vistoria=% falhou: %',
      NEW.id, v_vistoria_id, SQLERRM;
  END;

  PERFORM set_config('praticcar.in_vistoria_servico_sync', 'off', true);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_vistoria_on_servico_decisao ON public.servicos;
CREATE TRIGGER trg_sync_vistoria_on_servico_decisao
AFTER UPDATE OF status ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_vistoria_on_servico_decisao();

-- Espelho da mesma flag no trigger inverso para fechar o ciclo
-- (sync_servico_on_vistoria_decisao já existe; só adicionamos a flag
-- na função correspondente para detectar reentrada).
CREATE OR REPLACE FUNCTION public.sync_servico_on_vistoria_decisao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_novo_status_servico text;
  v_novo_status_agend   text;
  v_novo_status_inst    text;
  v_instalacao_id       uuid;
  v_cotacao_id          uuid;
  v_is_autovistoria     boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('aprovada','aprovada_ressalvas','reprovada','cancelada') THEN

    -- Marca a reentrada para o trigger oposto não rebater.
    PERFORM set_config('praticcar.in_vistoria_servico_sync', 'on', true);

    v_is_autovistoria := COALESCE(NEW.modalidade, '') = 'autovistoria';

    v_novo_status_servico := CASE NEW.status::text
                               WHEN 'reprovada' THEN 'cancelada'
                               WHEN 'cancelada' THEN 'cancelada'
                               ELSE 'concluida'
                             END;

    v_novo_status_agend := CASE NEW.status::text
                             WHEN 'reprovada' THEN 'cancelado'
                             WHEN 'cancelada' THEN 'cancelado'
                             ELSE 'realizado'
                           END;

    v_novo_status_inst := CASE NEW.status::text
                            WHEN 'reprovada' THEN 'cancelada'
                            WHEN 'cancelada' THEN 'cancelada'
                            ELSE 'concluida'
                          END;

    IF v_is_autovistoria THEN
      UPDATE public.servicos
         SET status = v_novo_status_servico::status_servico,
             concluida_em = COALESCE(concluida_em, now()),
             updated_at = now()
       WHERE vistoria_origem_id = NEW.id
         AND tipo IN ('vistoria_entrada')
         AND status::text IN ('agendada','em_rota','em_andamento','pendente','reagendada','em_analise');

      UPDATE public.agendamentos_base
         SET status = v_novo_status_agend,
             updated_at = now()
       WHERE vistoria_id = NEW.id
         AND status NOT IN ('realizado','cancelado');

      PERFORM set_config('praticcar.in_vistoria_servico_sync', 'off', true);
      RETURN NEW;
    END IF;

    UPDATE public.servicos
       SET status = v_novo_status_servico::status_servico,
           concluida_em = COALESCE(concluida_em, now()),
           updated_at = now()
     WHERE vistoria_origem_id = NEW.id
       AND status::text IN ('agendada','em_rota','em_andamento','pendente','reagendada','em_analise');

    UPDATE public.agendamentos_base
       SET status = v_novo_status_agend,
           updated_at = now()
     WHERE vistoria_id = NEW.id
       AND status NOT IN ('realizado','cancelado');

    v_instalacao_id := NEW.instalacao_id;
    v_cotacao_id    := NEW.cotacao_id;

    IF v_instalacao_id IS NULL THEN
      SELECT ab.instalacao_id INTO v_instalacao_id
        FROM public.agendamentos_base ab
       WHERE ab.vistoria_id = NEW.id AND ab.instalacao_id IS NOT NULL
       ORDER BY ab.created_at DESC LIMIT 1;
    END IF;

    IF v_instalacao_id IS NULL AND v_cotacao_id IS NOT NULL THEN
      SELECT i.id INTO v_instalacao_id
        FROM public.instalacoes i WHERE i.cotacao_id = v_cotacao_id
       ORDER BY i.created_at DESC LIMIT 1;
    END IF;

    IF v_instalacao_id IS NOT NULL THEN
      UPDATE public.instalacoes
         SET status = v_novo_status_inst::status_instalacao,
             concluida_em = COALESCE(concluida_em, now()),
             updated_at = now()
       WHERE id = v_instalacao_id
         AND status::text NOT IN ('concluida','cancelada');

      UPDATE public.servicos
         SET status = v_novo_status_servico::status_servico,
             concluida_em = COALESCE(concluida_em, now()),
             updated_at = now()
       WHERE instalacao_origem_id = v_instalacao_id
         AND status::text IN ('agendada','em_rota','em_andamento','pendente','reagendada','em_analise');

      IF NEW.instalacao_id IS NULL THEN
        UPDATE public.vistorias SET instalacao_id = v_instalacao_id WHERE id = NEW.id;
      END IF;
    END IF;

    PERFORM set_config('praticcar.in_vistoria_servico_sync', 'off', true);
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.fn_sync_vistoria_on_servico_decisao() IS
'Frente 1 (jun/26): quando servicos.status vai para aprovada/aprovada_ressalvas/reprovada/cancelada, espelha em vistorias via vistoria_origem_id ou instalacao_origem_id. Fecha o gap do caminho useAprovacaoMonitoramento (caso TTA5H86/SSA3G29). Anti-recursão via GUC praticcar.in_vistoria_servico_sync.';
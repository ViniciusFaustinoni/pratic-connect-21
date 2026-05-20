-- =============================================================================
-- Fix: técnico não consegue "Iniciar Tarefa" quando o servico é vistoria_entrada
-- Causa: sync_servico_to_instalacao só sincronizava instalador_responsavel_id
-- para tipo='instalacao'. Como vistoria_entrada ≡ instalacao (mesma visita),
-- a instalacao virava 'em_rota' sem instalador e o trigger validar_status_instalacao
-- abortava com "Status 'em_rota' requer um instalador atribuído".
-- Memória: mem://logic/operations/vistoria-entrada-equivale-instalacao
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_servico_to_instalacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Sincronizar para serviços que representam a 1ª visita física
  -- (instalacao OU vistoria_entrada — mesmo evento, ver memória)
  IF NEW.tipo IN ('instalacao','vistoria_entrada') AND NEW.instalacao_origem_id IS NOT NULL THEN

    -- Vai para em_rota / em_andamento → sincroniza instalador + status em UM UPDATE
    IF NEW.status IN ('em_rota', 'em_andamento')
       AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.profissional_id IS DISTINCT FROM NEW.profissional_id) THEN
      UPDATE instalacoes
      SET
        instalador_id = COALESCE(NEW.profissional_id, instalador_id),
        instalador_responsavel_id = COALESCE(NEW.profissional_id, instalador_responsavel_id),
        status = (NEW.status::text)::status_instalacao,
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id;

    -- Só mudou o profissional — propaga sem mexer no status
    ELSIF NEW.profissional_id IS DISTINCT FROM OLD.profissional_id THEN
      UPDATE instalacoes
      SET
        instalador_id = NEW.profissional_id,
        instalador_responsavel_id = COALESCE(NEW.profissional_id, instalador_responsavel_id),
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id;
    END IF;

    -- Conclusão
    IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM NEW.status THEN
      UPDATE instalacoes
      SET
        status = 'concluida',
        concluida_em = COALESCE(NEW.concluida_em, NOW()),
        instalador_responsavel_id = COALESCE(NEW.profissional_id, instalador_responsavel_id),
        rastreador_id = COALESCE(NEW.rastreador_id, rastreador_id),
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;

-- Rede de segurança: o sync genérico também leva o instalador quando a transição
-- exige um responsável (em_rota / em_andamento). Sem isso, qualquer outro tipo
-- de servico vinculado a uma instalacao quebraria o mesmo validador.
CREATE OR REPLACE FUNCTION public.sync_servicos_to_instalacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.instalacao_origem_id IS NOT NULL THEN
    IF NEW.status::text IN ('agendada', 'em_rota', 'em_andamento', 'concluida', 'reagendada', 'cancelada', 'em_analise', 'nao_compareceu') THEN
      IF NEW.status::text IN ('em_rota','em_andamento') THEN
        UPDATE instalacoes
        SET
          status = (NEW.status::text)::status_instalacao,
          instalador_id = COALESCE(NEW.profissional_id, instalador_id),
          instalador_responsavel_id = COALESCE(NEW.profissional_id, instalador_responsavel_id),
          updated_at = NOW()
        WHERE id = NEW.instalacao_origem_id
          AND status::text IS DISTINCT FROM NEW.status::text;
      ELSE
        UPDATE instalacoes
        SET
          status = (NEW.status::text)::status_instalacao,
          updated_at = NOW()
        WHERE id = NEW.instalacao_origem_id
          AND status::text IS DISTINCT FROM NEW.status::text;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.sync_servico_to_instalacao() IS
  'Propaga instalador + status do servico para a instalacao. Trata vistoria_entrada como equivalente a instalacao (mem://logic/operations/vistoria-entrada-equivale-instalacao). Evita bloqueio "Status em_rota requer instalador atribuído" quando técnico inicia tarefa de autovistoria.';
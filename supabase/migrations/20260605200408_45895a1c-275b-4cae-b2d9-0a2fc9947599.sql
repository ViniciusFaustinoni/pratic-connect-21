-- ============================================================
-- FIX: cascata indevida cancelando instalação recém-criada
-- ============================================================
-- Problema reproduzido em COT-20260605-091629949-127:
--   1) criar-instalacao-pos-pagamento INSERT servico tipo='instalacao'
--   2) trg cancelar_vistoria_entrada_orfa_servico cancela o servico
--      vistoria_entrada antigo
--   3) trg fn_sync_vistoria_on_servico_decisao cancela a vistoria de
--      origem (setando o GUC praticcar.in_vistoria_servico_sync='on')
--   4) trg sync_servico_on_vistoria_decisao roda mesmo com GUC='on'
--      (faltava o guard), não acha instalacao_id direto na vistoria,
--      cai no fallback por cotacao_id LIMIT 1 e CANCELA A NOVA
--      INSTALAÇÃO recém-criada.
--
-- Correção: incluir o mesmo guard de re-entrada já usado no trigger
-- inverso. A função preserva todo o resto do comportamento.

CREATE OR REPLACE FUNCTION public.sync_servico_on_vistoria_decisao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- Guard anti-recursão: se este UPDATE da vistoria veio do gatilho
    -- inverso (fn_sync_vistoria_on_servico_decisao), NÃO repropagar para
    -- servicos/instalacoes — senão o fallback por cotacao_id pode
    -- cancelar uma instalação legítima criada na mesma transação.
    IF current_setting('praticcar.in_vistoria_servico_sync', true) = 'on' THEN
      RETURN NEW;
    END IF;

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

    -- Fallback por cotacao_id só é seguro para APROVAÇÃO da vistoria
    -- (vincular a instalação concluindo o ciclo). Para CANCELAMENTO/
    -- REPROVAÇÃO, esse fallback corre risco de cancelar instalação
    -- legítima criada na mesma cotação (caso COT-20260605-091629949-127).
    IF v_instalacao_id IS NULL
       AND v_cotacao_id IS NOT NULL
       AND NEW.status::text NOT IN ('cancelada','reprovada') THEN
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
$$;

-- ============================================================
-- Saneamento: restaurar a instalação e o serviço da cotação afetada
-- ============================================================
UPDATE public.instalacoes
   SET status = 'agendada'::status_instalacao,
       concluida_em = NULL,
       observacoes = COALESCE(observacoes,'') ||
         E'\n[saneamento] Restaurada de cancelada→agendada — cancelamento espúrio por cascata de gatilho corrigida.',
       updated_at = now()
 WHERE id = '94d46303-3abe-4571-8f16-3429632630f2'
   AND status = 'cancelada';

UPDATE public.servicos
   SET status = 'agendada'::status_servico,
       concluida_em = NULL,
       observacoes = COALESCE(observacoes,'') ||
         E'\n[saneamento] Restaurada de cancelada→agendada — cancelamento espúrio por cascata de gatilho corrigida.',
       updated_at = now()
 WHERE id = '05cd24d2-b881-49ab-91be-c3ed7e31ec6d'
   AND status = 'cancelada';

-- Trigger: sincronizar agendamentos_base quando serviço entra em status terminal/reagendamento
CREATE OR REPLACE FUNCTION public.sync_agendamento_base_on_servico_terminal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_novo_status text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('cancelada','reagendada','nao_compareceu') THEN
    v_novo_status := CASE NEW.status
                       WHEN 'cancelada' THEN 'cancelado'
                       WHEN 'reagendada' THEN 'reagendado'
                       WHEN 'nao_compareceu' THEN 'nao_compareceu'
                     END;

    UPDATE agendamentos_base SET status = v_novo_status, updated_at = now()
     WHERE status IN ('agendado','pendente','confirmado')
       AND ( (NEW.cotacao_id IS NOT NULL AND cotacao_id = NEW.cotacao_id)
          OR (NEW.instalacao_origem_id IS NOT NULL AND instalacao_id = NEW.instalacao_origem_id)
          OR (NEW.vistoria_origem_id IS NOT NULL AND vistoria_id = NEW.vistoria_origem_id) );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_agendamento_base_on_servico_terminal ON public.servicos;
CREATE TRIGGER trg_sync_agendamento_base_on_servico_terminal
AFTER UPDATE OF status ON public.servicos
FOR EACH ROW EXECUTE FUNCTION public.sync_agendamento_base_on_servico_terminal();

-- ===== BACKFILL =====
-- 1) Fechar agendamentos_base órfãos cuja origem (cotação) só tem serviços terminais
UPDATE agendamentos_base ab SET status='cancelado', updated_at=now()
 WHERE ab.status IN ('agendado','pendente','confirmado')
   AND ab.cotacao_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM servicos s
                WHERE s.cotacao_id = ab.cotacao_id
                  AND s.status IN ('cancelada','reagendada','nao_compareceu','concluida'))
   AND NOT EXISTS (SELECT 1 FROM servicos s2
                    WHERE s2.cotacao_id = ab.cotacao_id
                      AND s2.status IN ('agendada','em_rota','em_andamento','pendente'));

-- 2) Mesmo backfill via instalacao_id
UPDATE agendamentos_base ab SET status='cancelado', updated_at=now()
 WHERE ab.status IN ('agendado','pendente','confirmado')
   AND ab.instalacao_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM servicos s
                WHERE s.instalacao_origem_id = ab.instalacao_id
                  AND s.status IN ('cancelada','reagendada','nao_compareceu','concluida'))
   AND NOT EXISTS (SELECT 1 FROM servicos s2
                    WHERE s2.instalacao_origem_id = ab.instalacao_id
                      AND s2.status IN ('agendada','em_rota','em_andamento','pendente'));

-- 3) Mesmo backfill via vistoria_id
UPDATE agendamentos_base ab SET status='cancelado', updated_at=now()
 WHERE ab.status IN ('agendado','pendente','confirmado')
   AND ab.vistoria_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM servicos s
                WHERE s.vistoria_origem_id = ab.vistoria_id
                  AND s.status IN ('cancelada','reagendada','nao_compareceu','concluida'))
   AND NOT EXISTS (SELECT 1 FROM servicos s2
                    WHERE s2.vistoria_origem_id = ab.vistoria_id
                      AND s2.status IN ('agendada','em_rota','em_andamento','pendente'));

-- 4) Em (cotacao_id, veiculo_id) com múltiplas instalacoes ativas, manter só a mais recente
WITH dup AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY cotacao_id, veiculo_id ORDER BY created_at DESC) rn
    FROM instalacoes
   WHERE status IN ('agendada','em_andamento')
     AND cotacao_id IS NOT NULL
     AND veiculo_id IS NOT NULL
)
UPDATE instalacoes SET status='cancelada', updated_at=now()
 WHERE id IN (SELECT id FROM dup WHERE rn > 1);

-- 5) Cancelar servicos órfãos das instalacoes acabadas de cancelar
UPDATE servicos SET status='cancelada', updated_at=now()
 WHERE instalacao_origem_id IN (
   SELECT id FROM instalacoes
    WHERE status='cancelada'
      AND updated_at >= now() - interval '1 minute'
 ) AND status IN ('agendada','pendente');
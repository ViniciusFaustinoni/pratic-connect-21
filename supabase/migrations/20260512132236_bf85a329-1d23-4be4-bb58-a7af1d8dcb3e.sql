-- 1) Estender trigger em servicos para fechar agendamentos_base em terminais positivos
CREATE OR REPLACE FUNCTION public.sync_agendamento_base_on_servico_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_novo_status text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('cancelada','reagendada','nao_compareceu','concluida','aprovada','reprovada','aprovada_ressalvas') THEN
    v_novo_status := CASE NEW.status
                       WHEN 'cancelada' THEN 'cancelado'
                       WHEN 'reagendada' THEN 'cancelado'  -- novo agendamento será criado pelo fluxo de reagendamento
                       WHEN 'nao_compareceu' THEN 'nao_compareceu'
                       ELSE 'realizado'
                     END;

    UPDATE agendamentos_base
       SET status = v_novo_status,
           atendido_por = COALESCE(atendido_por, NEW.profissional_id),
           updated_at = now()
     WHERE status IN ('agendado','pendente','confirmado','em_atendimento')
       AND ( (NEW.cotacao_id IS NOT NULL AND cotacao_id = NEW.cotacao_id)
          OR (NEW.instalacao_origem_id IS NOT NULL AND instalacao_id = NEW.instalacao_origem_id)
          OR (NEW.vistoria_origem_id IS NOT NULL AND vistoria_id = NEW.vistoria_origem_id) );
  END IF;
  RETURN NEW;
END $function$;

-- 2) Novo trigger em instalacoes para fechar agendamentos_base ao concluir/cancelar a instalação base
CREATE OR REPLACE FUNCTION public.sync_agendamento_base_on_instalacao_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_novo_status text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('concluida','cancelada') THEN
    v_novo_status := CASE NEW.status
                       WHEN 'cancelada' THEN 'cancelado'
                       ELSE 'realizado'
                     END;

    UPDATE agendamentos_base
       SET status = v_novo_status,
           atendido_por = COALESCE(atendido_por, NEW.instalador_id, NEW.instalador_responsavel_id),
           updated_at = now()
     WHERE status IN ('agendado','pendente','confirmado','em_atendimento')
       AND ( instalacao_id = NEW.id
          OR (NEW.cotacao_id IS NOT NULL AND cotacao_id = NEW.cotacao_id) );
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_sync_agendamento_base_on_instalacao_terminal ON public.instalacoes;
CREATE TRIGGER trg_sync_agendamento_base_on_instalacao_terminal
  AFTER UPDATE OF status ON public.instalacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_agendamento_base_on_instalacao_terminal();

-- 3) Backfill — agendamentos_base órfãos cuja instalação/vistoria já está em estado terminal
UPDATE agendamentos_base ab
   SET status = CASE WHEN i.status='cancelada' THEN 'cancelado' ELSE 'realizado' END,
       atendido_por = COALESCE(ab.atendido_por, i.instalador_id, i.instalador_responsavel_id),
       updated_at = now()
  FROM instalacoes i
 WHERE ab.instalacao_id = i.id
   AND ab.status IN ('agendado','pendente','confirmado','em_atendimento')
   AND i.status IN ('concluida','cancelada');

UPDATE agendamentos_base ab
   SET status = CASE WHEN v.status IN ('cancelada','reprovada') THEN 'cancelado' ELSE 'realizado' END,
       updated_at = now()
  FROM vistorias v
 WHERE ab.vistoria_id = v.id
   AND ab.status IN ('agendado','pendente','confirmado','em_atendimento')
   AND v.status IN ('concluida','aprovada','reprovada','em_analise','cancelada');
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
                       WHEN 'reagendada' THEN 'cancelado'
                       WHEN 'nao_compareceu' THEN 'nao_compareceu'
                       ELSE 'realizado'
                     END;

    UPDATE agendamentos_base ab
       SET status = v_novo_status,
           atendido_por = COALESCE(ab.atendido_por, NEW.profissional_id),
           updated_at = now()
     WHERE ab.status IN ('agendado','pendente','confirmado','em_atendimento')
       AND (
            -- Match direto por origem materializada (instalação ou vistoria criadas a partir do agendamento)
            (NEW.instalacao_origem_id IS NOT NULL AND ab.instalacao_id = NEW.instalacao_origem_id)
         OR (NEW.vistoria_origem_id   IS NOT NULL AND ab.vistoria_id   = NEW.vistoria_origem_id)
            -- Match por cotação SOMENTE para serviços que representam o desfecho do agendamento base
            -- (instalação/vistoria completa do técnico). NUNCA para vistoria_entrada (autovistoria
            -- antecipada materializada), que coexiste com o agendamento base posterior.
         OR (NEW.cotacao_id IS NOT NULL
             AND ab.cotacao_id = NEW.cotacao_id
             AND NEW.tipo IN ('instalacao','vistoria_completa','vistoria'))
       );
  END IF;
  RETURN NEW;
END $function$;
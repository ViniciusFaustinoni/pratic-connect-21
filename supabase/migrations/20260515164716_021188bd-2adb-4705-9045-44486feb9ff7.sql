-- 1) Fix da trigger: enum tipo_servico não tem 'vistoria_completa' nem 'vistoria'.
--    A distinção autovistoria × vistoria do técnico é por `modalidade`, não por tipo.
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
            -- Match direto por origem materializada
            (NEW.instalacao_origem_id IS NOT NULL AND ab.instalacao_id = NEW.instalacao_origem_id)
         OR (NEW.vistoria_origem_id   IS NOT NULL AND ab.vistoria_id   = NEW.vistoria_origem_id)
            -- Match por cotação SOMENTE para serviços que representam o desfecho do
            -- agendamento base (instalação ou vistoria_entrada PRESENCIAL do técnico).
            -- NUNCA para autovistoria, que coexiste com o agendamento base posterior.
         OR (NEW.cotacao_id IS NOT NULL
             AND ab.cotacao_id = NEW.cotacao_id
             AND (
                  NEW.tipo = 'instalacao'
               OR (NEW.tipo = 'vistoria_entrada' AND COALESCE(NEW.modalidade,'') <> 'autovistoria')
             ))
       );
  END IF;
  RETURN NEW;
END $function$;

-- 2) Correção retroativa: Marcus Vinicius (LTB4J74)
UPDATE public.servicos
SET status = 'aprovada',
    analisado_em = COALESCE(analisado_em, now()),
    observacoes_analise = COALESCE(observacoes_analise, '') ||
      ' [CORREÇÃO RETROATIVA] Autovistoria aprovada pelo Cadastro — R&F liberado. Aguardando vistoria/instalação presencial do técnico para entrar na fila do Monitoramento.',
    updated_at = now()
WHERE id = '49b7548b-d391-4b2c-9f3a-f6c84d94eb0a'
  AND status = 'concluida'
  AND tipo = 'vistoria_entrada'
  AND modalidade = 'autovistoria';

-- 3) Auditoria
INSERT INTO public.associados_historico (associado_id, contrato_id, tipo, descricao, usuario_id)
SELECT s.associado_id, s.contrato_id, 'status_alterado',
  'Correção retroativa: servico de autovistoria movido de concluida → aprovada. Caso só voltará à fila do Monitoramento após a vistoria/instalação presencial do técnico (servico 21611742-d96e-4765-b8b5-1a68f4ad8353 em em_andamento).',
  NULL
FROM public.servicos s
WHERE s.id = '49b7548b-d391-4b2c-9f3a-f6c84d94eb0a';
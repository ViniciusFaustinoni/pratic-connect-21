
-- 1) SANEAMENTO: restaurar serviço de retirada do Pablo (QQJ7H25 / RET-2026-00008)
--    Estado-alvo extraído do logs_auditoria (dados_anteriores da realocação irregular às 15:11:24)
SET LOCAL app.realocacao_monitoramento = 'on';

UPDATE public.servicos
SET status = 'em_andamento'::status_servico,
    profissional_id = '715e3b93-ea8b-462a-8920-2cb9f4275bff',
    iniciada_em = '2026-05-26T14:34:00.33302+00:00'::timestamptz,
    em_rota_em = '2026-05-26T14:33:58.335084+00:00'::timestamptz,
    periodo = 'manha',
    observacoes = '[26/05/2026 12:30] RESTAURADO->TECNICO (Pablo) por sistema — realocação irregular revertida (saneamento RET-2026-00008)',
    updated_at = now()
WHERE id = '6b24a387-cd0e-4f39-9038-a9d691cb7e7a';

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, usuario_nome, dados_novos)
VALUES (
  'editar', 'monitoramento', 'servicos', '6b24a387-cd0e-4f39-9038-a9d691cb7e7a',
  'Saneamento: serviço RET-2026-00008 (Pablo) restaurado de agendada→em_andamento. Realocação para FILA por "ERRO AO FINALIZAR" não pode esvaziar técnico ativo.',
  'sistema (saneamento)',
  jsonb_build_object('status','em_andamento','profissional_id','715e3b93-ea8b-462a-8920-2cb9f4275bff','motivo','reverter realocação irregular pós-erro de finalização')
);

-- 2) HARDENING DO GUARD: também protege em_rota e bloqueia "ir pra fila" mesmo com bypass
CREATE OR REPLACE FUNCTION public.guard_servico_em_andamento_saida_irregular()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_bypass text := current_setting('app.realocacao_monitoramento', true);
  v_protected boolean := OLD.status IN ('em_andamento'::status_servico, 'em_rota'::status_servico);
BEGIN
  IF TG_OP = 'UPDATE' AND v_protected THEN

    -- (A) Mesmo SOB bypass de realocação oficial: nunca esvaziar o técnico de um serviço
    -- em execução. Realocar = transferir para OUTRO técnico, não devolver para a fila.
    IF NEW.profissional_id IS NULL AND OLD.profissional_id IS NOT NULL THEN
      RAISE EXCEPTION 'SERVICO_EM_EXECUCAO_PROTEGIDO: serviço em % não pode voltar para a fila — realocar exige escolher OUTRO técnico, e devolver-à-fila só após conclusão/cancelamento explícito.', OLD.status
        USING ERRCODE = 'check_violation';
    END IF;

    -- Demais regras: aplicam-se apenas FORA do bypass de realocação oficial
    IF COALESCE(v_bypass, 'off') <> 'on' THEN
      IF NEW.profissional_id IS DISTINCT FROM OLD.profissional_id THEN
        RAISE EXCEPTION 'SERVICO_EM_EXECUCAO_PROTEGIDO: serviço em % não pode trocar de técnico fora da realocação oficial do Monitoramento.', OLD.status
          USING ERRCODE = 'check_violation';
      END IF;

      IF NEW.status IS DISTINCT FROM OLD.status
         AND NEW.status NOT IN ('em_rota','em_andamento','concluida','em_analise','aprovada','aprovada_ressalvas','reprovada','cancelada') THEN
        RAISE EXCEPTION 'SERVICO_EM_EXECUCAO_PROTEGIDO: serviço em % só pode avançar para terminal ou ser realocado oficialmente.', OLD.status
          USING ERRCODE = 'check_violation';
      END IF;

      -- Não permitir regressão para "agendada" / limpar timestamps de execução
      IF NEW.status = 'agendada'::status_servico THEN
        RAISE EXCEPTION 'SERVICO_EM_EXECUCAO_PROTEGIDO: serviço em % não pode regredir para agendada fora da realocação oficial do Monitoramento.', OLD.status
          USING ERRCODE = 'check_violation';
      END IF;

      IF OLD.status = 'em_andamento'::status_servico AND NEW.iniciada_em IS NULL AND OLD.iniciada_em IS NOT NULL THEN
        RAISE EXCEPTION 'SERVICO_EM_EXECUCAO_PROTEGIDO: não é permitido limpar iniciada_em de serviço em andamento fora da realocação oficial.'
          USING ERRCODE = 'check_violation';
      END IF;

      IF NEW.em_rota_em IS NULL AND OLD.em_rota_em IS NOT NULL THEN
        RAISE EXCEPTION 'SERVICO_EM_EXECUCAO_PROTEGIDO: não é permitido limpar em_rota_em de serviço em execução fora da realocação oficial.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

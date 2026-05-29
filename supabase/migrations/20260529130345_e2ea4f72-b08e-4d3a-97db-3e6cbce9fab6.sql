-- Remove o guard que bloqueava INSERT em agendamentos_base por falta de aprovação do Cadastro.
-- Motivo: agendamento é a última etapa do LINK PÚBLICO (módulo do associado).
-- O gate Cadastro → Monitoramento já vive corretamente no CONSUMO
-- (hooks useAtribuicaoManual/useServicos/useServicosAtribuidos/useFilaServicos
--  + view servicos_pendentes_rota), filtrando por contratos.aprovado_em IS NOT NULL.
-- Trigger era redundante e quebrava o link público.

DROP TRIGGER IF EXISTS trg_guard_agendamento_base_exige_cadastro_aprovado
  ON public.agendamentos_base;

DROP FUNCTION IF EXISTS public.fn_guard_agendamento_base_exige_cadastro_aprovado();
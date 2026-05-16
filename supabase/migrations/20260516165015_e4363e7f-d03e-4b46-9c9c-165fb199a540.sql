-- Restaura o fluxo canônico: Cadastro nunca é aprovado automaticamente por avanço
-- operacional. Remove os triggers introduzidos em 20260515140337 que marcavam
-- contratos.cadastro_aprovado=true a partir de servicos/instalacoes/agendamentos_base
-- e, consequentemente, jogavam casos no Monitoramento antes da aprovação manual.

DROP TRIGGER IF EXISTS trg_servico_promove_cadastro ON public.servicos;
DROP TRIGGER IF EXISTS trg_agendamento_base_promove_cadastro ON public.agendamentos_base;
DROP TRIGGER IF EXISTS trg_instalacao_promove_cadastro ON public.instalacoes;

DROP FUNCTION IF EXISTS public.fn_trg_servico_promove_cadastro() CASCADE;
DROP FUNCTION IF EXISTS public.fn_trg_agendamento_base_promove_cadastro() CASCADE;
DROP FUNCTION IF EXISTS public.fn_trg_instalacao_promove_cadastro() CASCADE;
DROP FUNCTION IF EXISTS public.fn_auto_promover_cadastro_pos_operacao(uuid, text) CASCADE;

-- Auditoria
INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao)
VALUES (
  'editar',
  'cadastro',
  'contratos',
  gen_random_uuid(),
  'Removida autoaprovação do Cadastro por avanço operacional. fn_auto_promover_cadastro_pos_operacao e seus triggers (servicos/instalacoes/agendamentos_base) foram dropados. Cadastro volta a exigir aprovação manual antes do Monitoramento.'
);
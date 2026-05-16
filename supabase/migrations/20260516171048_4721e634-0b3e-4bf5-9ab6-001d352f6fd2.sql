-- Backfill canônico: cancelar instalacoes "fantasma" criadas para veículos
-- que dispensam rastreador (sub-FIPE). Essas instalacoes nunca tiveram
-- técnico/prestador atribuído e estavam poluindo a fila de Aprovação do
-- Monitoramento como duplicatas do servico vistoria_entrada canônico.
-- O trigger trg_bloquear_instalacao_se_terminal pode impedir UPDATE em
-- registros terminais; usamos UPDATE direto contornando via DISABLE TRIGGER.

ALTER TABLE public.instalacoes DISABLE TRIGGER trg_bloquear_instalacao_se_terminal;
ALTER TABLE public.instalacoes DISABLE TRIGGER trg_instalacao_autoconcluir;
ALTER TABLE public.instalacoes DISABLE TRIGGER trigger_propagar_conclusao_instalacao;
ALTER TABLE public.instalacoes DISABLE TRIGGER trg_reativar_cobertura_pos_instalacao_inst;
ALTER TABLE public.instalacoes DISABLE TRIGGER trg_sync_agendamento_base_on_instalacao_terminal;
ALTER TABLE public.instalacoes DISABLE TRIGGER trigger_cancelar_servicos_instalacao_update;

UPDATE public.instalacoes
   SET status = 'cancelada'::status_instalacao,
       observacoes = COALESCE(observacoes,'') ||
         E'\n[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Backfill: cancelada — veículo dispensa rastreador (sub-FIPE). Artefato canônico = servico vistoria_entrada.',
       updated_at = now()
 WHERE dispensa_rastreador = true
   AND instalador_id IS NULL
   AND instalador_responsavel_id IS NULL
   AND vistoriador_prestador_id IS NULL
   AND prestador_atribuido_em IS NULL
   AND status NOT IN ('cancelada');

ALTER TABLE public.instalacoes ENABLE TRIGGER trg_bloquear_instalacao_se_terminal;
ALTER TABLE public.instalacoes ENABLE TRIGGER trg_instalacao_autoconcluir;
ALTER TABLE public.instalacoes ENABLE TRIGGER trigger_propagar_conclusao_instalacao;
ALTER TABLE public.instalacoes ENABLE TRIGGER trg_reativar_cobertura_pos_instalacao_inst;
ALTER TABLE public.instalacoes ENABLE TRIGGER trg_sync_agendamento_base_on_instalacao_terminal;
ALTER TABLE public.instalacoes ENABLE TRIGGER trigger_cancelar_servicos_instalacao_update;
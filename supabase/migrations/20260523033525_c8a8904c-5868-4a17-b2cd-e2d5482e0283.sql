ALTER TABLE public.logs_auditoria DROP CONSTRAINT IF EXISTS logs_auditoria_acao_check;

ALTER TABLE public.logs_auditoria ADD CONSTRAINT logs_auditoria_acao_check
  CHECK (acao::text = ANY (ARRAY[
    -- whitelist original (22)
    'login','logout','criar','editar','excluir','visualizar','exportar',
    'aprovar','rejeitar','reprovar','alterar_senha','alterar_permissao',
    'configuracao','atribuir','ativar','desativar','reativar','cancelar',
    'enviar','duplicar','importar','baixar',
    -- escopo do trabalho atual (8)
    'troca_titularidade_efetivada',
    'troca_titularidade_notificacao_ignorada',
    'troca_titularidade_vistoria_dispensada',
    'troca_titularidade_pendencia_rastreador',
    'aprovar_proposta_bloqueado_caminho_incompleto',
    'aprovar_proposta_bloqueado_sem_agendamento',
    'aprovar_proposta_bloqueado_sem_instalacao',
    'devolver_ao_cadastro',
    -- valores frequentes detectados nas 18 edges sob vigia (8)
    'decisao_sga',
    'autovistoria_materializada',
    'suspensao_automatica',
    'suspensao_manual',
    'documentos_solicitados_criados',
    'cancelamento_nao_instalacao',
    'abrir_servico_vistoria_interna_suspenso',
    'liberacao_reagendamento'
  ]::text[]));
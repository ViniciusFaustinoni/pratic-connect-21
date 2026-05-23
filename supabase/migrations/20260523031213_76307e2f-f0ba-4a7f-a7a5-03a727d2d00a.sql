-- Ampliar whitelist de tipos em associados_historico para cobrir
-- todos os valores efetivamente inseridos no codebase (varredura 23/05/2026).
-- O CHECK anterior aceitava 24 tipos; INSERTs com qualquer outro valor
-- falhavam silenciosamente porque os callers não checavam erro.

ALTER TABLE public.associados_historico
  DROP CONSTRAINT IF EXISTS associados_historico_tipo_check;

ALTER TABLE public.associados_historico
  ADD CONSTRAINT associados_historico_tipo_check
  CHECK (tipo::text = ANY (ARRAY[
    -- Originais
    'associado_criado','status_alterado','dados_atualizados',
    'documento_enviado','documento_aprovado','documento_reprovado',
    'veiculo_adicionado','veiculo_removido',
    'instalacao_agendada','instalacao_concluida','instalacao_cancelada',
    'boleto_gerado','boleto_pago','boleto_cancelado',
    'chamado_aberto','chamado_concluido',
    'sinistro_aberto','sinistro_atualizado','sinistro_encerrado',
    'contrato_assinado','observacao_adicionada',
    'ressalva_registrada','ressalva_aprovada_monitoramento','ressalva_declinada_monitoramento',
    -- Novos identificados via varredura
    'forma_pagamento_alterada',
    'documento_anexado','documento_assinado',
    'senha_definida','senha_redefinida','acesso_criado','acesso_vinculado',
    'vistoria_iniciada','vistoria_aprovada','vistoria_reprovada',
    'vistoria_tecnico_solicitada_monitoramento',
    'veiculo_aprovado','veiculo_recusado','veiculo_ativado','veiculo_inativado',
    'veiculo_reativado','veiculo_recebido','veiculo_recuperado','veiculo_transferido',
    'suspensao_cobertura_instalacao',
    'troca_titularidade_saida','troca_titularidade_entrada',
    'substituicao_veiculo','indenizacao_iniciada',
    'cliente_ativado','cliente_inativado',
    'inadimplencia_notificada','adimplencia_notificada',
    'sincronizacao_plataforma',
    'protecao_360_aprovada_monitoramento','protecao_360_reprovada_monitoramento',
    'ativacao',
    'blacklist_recusa_instalador','contrato_cancelado_recusa',
    'enviado_monitoramento','negado_pelo_instalador_pendente_analise',
    'nova_vistoria_recusa','recusa_revertida'
  ]::text[]));
ALTER TABLE public.associados_historico
  DROP CONSTRAINT associados_historico_tipo_check;

ALTER TABLE public.associados_historico
  ADD CONSTRAINT associados_historico_tipo_check
  CHECK (tipo::text = ANY (ARRAY[
    'associado_criado', 'status_alterado', 'dados_atualizados',
    'documento_enviado', 'documento_aprovado', 'documento_reprovado',
    'veiculo_adicionado', 'veiculo_removido',
    'instalacao_agendada', 'instalacao_concluida', 'instalacao_cancelada',
    'boleto_gerado', 'boleto_pago', 'boleto_cancelado',
    'chamado_aberto', 'chamado_concluido',
    'sinistro_aberto', 'sinistro_atualizado', 'sinistro_encerrado',
    'contrato_assinado', 'observacao_adicionada',
    'ressalva_registrada', 'ressalva_aprovada_monitoramento', 'ressalva_declinada_monitoramento'
  ]::text[]));
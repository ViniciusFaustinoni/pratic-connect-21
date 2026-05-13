delete from public.agendamentos_base
where cotacao_id in (
  select id
  from public.cotacoes
  where veiculo_placa = 'KOU6D37'
    and tipo_entrada = 'troca_titularidade'
);

delete from public.cotacoes
where veiculo_placa = 'KOU6D37'
  and tipo_entrada = 'troca_titularidade';

update public.solicitacoes_troca_titularidade
set status = 'aguardando_cadastro',
    cotacao_id = null,
    aprovado_cadastro_em = null,
    aprovado_cadastro_por = null,
    observacao_cadastro = null,
    aprovado_monitoramento_em = null,
    aprovado_monitoramento_por = null,
    observacao_monitoramento = null,
    servico_vistoria_id = null,
    analise_previa_resultado = null,
    analise_previa_em = null,
    efetivada_em = null,
    motivo_reprovacao = null,
    reprovado_por = null,
    reprovado_em = null,
    updated_at = now()
where id = '52cc74c1-910d-4ac7-b854-84cd28db7a0d';

update public.veiculos
set em_troca_titularidade = true,
    updated_at = now()
where id = (
  select veiculo_id
  from public.solicitacoes_troca_titularidade
  where id = '52cc74c1-910d-4ac7-b854-84cd28db7a0d'
);
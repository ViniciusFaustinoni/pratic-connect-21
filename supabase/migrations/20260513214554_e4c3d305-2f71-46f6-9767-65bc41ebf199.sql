-- Reset troca KOU6D37 (Marcus Vinicius) para a fase de termo assinado, sem cotação
DO $$
DECLARE
  v_sol_id uuid := '52cc74c1-910d-4ac7-b854-84cd28db7a0d';
BEGIN
  -- Apaga agendamentos/instalações/serviços/contratos das cotações de troca da KOU6D37
  DELETE FROM public.agendamentos_base
   WHERE cotacao_id IN (
     SELECT id FROM public.cotacoes
      WHERE upper(regexp_replace(coalesce(veiculo_placa,''),'[^A-Za-z0-9]','','g')) = 'KOU6D37'
        AND tipo_entrada = 'troca_titularidade'
   );

  DELETE FROM public.instalacoes
   WHERE cotacao_id IN (
     SELECT id FROM public.cotacoes
      WHERE upper(regexp_replace(coalesce(veiculo_placa,''),'[^A-Za-z0-9]','','g')) = 'KOU6D37'
        AND tipo_entrada = 'troca_titularidade'
   );

  DELETE FROM public.servicos
   WHERE cotacao_id IN (
     SELECT id FROM public.cotacoes
      WHERE upper(regexp_replace(coalesce(veiculo_placa,''),'[^A-Za-z0-9]','','g')) = 'KOU6D37'
        AND tipo_entrada = 'troca_titularidade'
   );

  DELETE FROM public.contratos
   WHERE cotacao_id IN (
     SELECT id FROM public.cotacoes
      WHERE upper(regexp_replace(coalesce(veiculo_placa,''),'[^A-Za-z0-9]','','g')) = 'KOU6D37'
        AND tipo_entrada = 'troca_titularidade'
   )
   AND status NOT IN ('ativo','cancelado');

  DELETE FROM public.cotacoes
   WHERE upper(regexp_replace(coalesce(veiculo_placa,''),'[^A-Za-z0-9]','','g')) = 'KOU6D37'
     AND tipo_entrada = 'troca_titularidade';

  UPDATE public.solicitacoes_troca_titularidade
     SET status                     = 'aguardando_cadastro',
         cotacao_id                 = NULL,
         aprovado_cadastro_em       = NULL,
         aprovado_cadastro_por      = NULL,
         observacao_cadastro        = NULL,
         aprovado_monitoramento_em  = NULL,
         aprovado_monitoramento_por = NULL,
         observacao_monitoramento   = NULL,
         servico_vistoria_id        = NULL,
         analise_previa_resultado   = NULL,
         analise_previa_em          = NULL,
         efetivada_em               = NULL,
         motivo_reprovacao          = NULL,
         reprovado_por              = NULL,
         reprovado_em               = NULL,
         novo_associado_id          = NULL,
         updated_at                 = now()
   WHERE id = v_sol_id;
END $$;
-- Reset troca KOU6D37 para fase pós-assinatura do termo de cancelamento
DELETE FROM public.agendamentos_base
 WHERE cotacao_id = '3f0408b9-939d-47c9-890a-0dc1d98bd43c';

DELETE FROM public.cotacoes
 WHERE id = '3f0408b9-939d-47c9-890a-0dc1d98bd43c';

UPDATE public.solicitacoes_troca_titularidade
   SET status                       = 'aguardando_cadastro',
       cotacao_id                   = NULL,
       aprovado_cadastro_em         = NULL,
       aprovado_cadastro_por        = NULL,
       observacao_cadastro          = NULL,
       aprovado_monitoramento_em    = NULL,
       aprovado_monitoramento_por   = NULL,
       observacao_monitoramento     = NULL,
       servico_vistoria_id          = NULL,
       analise_previa_resultado     = NULL,
       analise_previa_em            = NULL,
       efetivada_em                 = NULL,
       motivo_reprovacao            = NULL,
       reprovado_por                = NULL,
       reprovado_em                 = NULL,
       updated_at                   = now()
 WHERE id = '52cc74c1-910d-4ac7-b854-84cd28db7a0d';
-- 1) Limpar agendamentos_base e cotações órfãs criadas pela troca da KOU6D37
DELETE FROM public.agendamentos_base
 WHERE cotacao_id IN (
   '6814d1b5-1a5e-4794-be2b-b489a49c9348',
   'b21f3c36-2a69-4bde-8d3c-1aa75d44ce11'
 );

DELETE FROM public.cotacoes
 WHERE id IN (
   '6814d1b5-1a5e-4794-be2b-b489a49c9348',
   'b21f3c36-2a69-4bde-8d3c-1aa75d44ce11'
 );

-- 2) Voltar a solicitação para o estado pós-assinatura do termo
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
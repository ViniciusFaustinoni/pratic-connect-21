DELETE FROM public.logs_auditoria
WHERE tabela = 'solicitacoes_troca_titularidade'
   OR registro_id::text IN (
     '33dd5531-f99f-459f-bcec-1814b1445d25',
     '571d8bc5-e56b-410f-ab8f-b5a8521dc2f7',
     '13893972-b8a6-4b01-8ef4-9e34c30cbf45',
     'd0208f3c-f5fe-4856-a390-af270e37c52e',
     'd411a54c-8ca4-4356-996d-569ebf93e94d',
     'c8856c99-d918-469f-94cd-23ac9d5dc6d2',
     '51c14014-5046-4092-b97c-8f08eb674975',
     'e07eb529-1030-4cab-8c4c-7d47ea58fdc5'
   )
   OR descricao ILIKE '%troca%titular%'
   OR dados_anteriores::text ILIKE '%solicitacoes_troca_titularidade%'
   OR dados_novos::text ILIKE '%solicitacoes_troca_titularidade%';

DELETE FROM public.edge_functions_logs
WHERE function_name IN (
  'criar-solicitacao-troca-titularidade',
  'criar-cotacao-troca-titularidade',
  'vincular-cotacao-troca',
  'aprovar-troca-cadastro',
  'aprovar-troca-monitoramento',
  'reprovar-troca-titularidade',
  'efetivar-troca-titularidade',
  'enviar-termo-cancelamento-troca',
  'analisar-novo-titular-troca',
  'cron-expirar-trocas-titularidade'
);
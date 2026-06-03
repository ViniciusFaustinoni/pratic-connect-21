UPDATE public.vistorias
   SET status = 'aprovada',
       analisado_em = now(),
       concluida_em = COALESCE(concluida_em, now()),
       updated_at = now()
 WHERE id = '4ecc4e63-603c-4932-9452-2e3e4a8cfe11'
   AND status = 'pendente';

UPDATE public.servicos
   SET status = 'concluida',
       concluida_em = now(),
       updated_at = now()
 WHERE id = '73dff5c7-72f0-4456-93cc-2e322de560a8'
   AND status = 'em_analise';

UPDATE public.veiculos
   SET cobertura_roubo_furto = true,
       updated_at = now()
 WHERE id = '0c63d99f-5d15-4bdb-96f1-64c97bd0557a';

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, dados_novos)
VALUES (
  'criar',
  'cadastro',
  'contratos',
  '03c04f4c-fd10-48c8-8298-28b5c8bcaaee',
  '[SANEAMENTO_LIMBO][FALHA_LOG_AUDITORIA acao=saneamento_limbo] COT-20260602-090235466-549 (DIOGO LUIS): aprovar-proposta promoveu servico sem aprovar a vistoria; guard derrubou; corrigido manualmente.',
  jsonb_build_object('cotacao','COT-20260602-090235466-549','vistoria_id','4ecc4e63-603c-4932-9452-2e3e4a8cfe11','servico_id','73dff5c7-72f0-4456-93cc-2e322de560a8','veiculo_id','0c63d99f-5d15-4bdb-96f1-64c97bd0557a')
);
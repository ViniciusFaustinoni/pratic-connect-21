
UPDATE public.associados
   SET status='aguardando_instalacao'::status_associado, updated_at=now()
 WHERE id='92c39f2c-2957-4989-b78c-a056e1b99ebd'
   AND status='aguardando_aprovacao_monitoramento';

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, dados_novos)
VALUES ('editar','monitoramento','associados','92c39f2c-2957-4989-b78c-a056e1b99ebd',
 'Hotfix rebobinamento pós-instalação (CIRLAINE/0KMB9B3B): status aguardando_aprovacao_monitoramento → aguardando_instalacao para destravar ativar-associado',
 jsonb_build_object('status','aguardando_instalacao','motivo','hotfix-rebobinados-26052026'));

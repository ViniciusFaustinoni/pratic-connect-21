UPDATE public.veiculos
SET status = 'instalacao_pendente', updated_at = now()
WHERE id = 'd53acb36-0e8c-4683-8537-0651c724d454'
  AND status = 'em_analise';

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, usuario_nome, dados_anteriores, dados_novos)
VALUES ('editar','veiculos','veiculos','d53acb36-0e8c-4683-8537-0651c724d454',
        '[HOTFIX_KPJ4994] status em_analise -> instalacao_pendente para destravar ativar-associado (rastreador IMEI 354522186314659 instalado desde 26/05 22:26; contrato 86ea58cb ativo desde 26/05 21:22; veículo ficou preso porque guard de rastreador bloqueou no momento original).',
        'Sistema',
        jsonb_build_object('status','em_analise'),
        jsonb_build_object('status','instalacao_pendente'));
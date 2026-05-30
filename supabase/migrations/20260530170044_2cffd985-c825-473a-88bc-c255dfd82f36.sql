-- Hotfix MARCUS AURELIO CAPPILLUPPI DA SILVA (LSQ6E05)
-- Rebobinamento pós-instalação: operador mudou ativo->recusado em 21/05; instalação concluída em 07/05 com rastreador instalado
-- Restaurar para aguardando_instalacao/instalacao_pendente para permitir ativar-associado promover novamente
UPDATE public.associados SET status='aguardando_instalacao' WHERE id='4027e672-7ab6-4ace-a8bf-c907a1d23bf7' AND status='recusado';
UPDATE public.veiculos SET status='instalacao_pendente' WHERE id='6c240d65-764c-45f7-8158-f73008407a64' AND status='recusado';
INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, dados_novos)
VALUES ('editar','associados','associados','4027e672-7ab6-4ace-a8bf-c907a1d23bf7','[HOTFIX] Reverte recusado->aguardando_instalacao p/ ativar-associado (rebobinamento pós-instalação)', jsonb_build_object('status','aguardando_instalacao','motivo','rebobinamento_pos_instalacao_LSQ6E05'));
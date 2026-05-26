
-- LMP3D41 — MARCELO LESSA J. DE OLIVEIRA
UPDATE public.associados SET status='aguardando_instalacao'::status_associado, updated_at=now()
 WHERE id='2300c0ca-9ce2-4a9d-bf65-9206fa0cc492' AND status='em_analise';
UPDATE public.veiculos SET status='instalacao_pendente'::status_veiculo, updated_at=now()
 WHERE id='af315231-3767-4e05-bc03-fcdb67a85f80' AND status='em_analise';

-- 0KMB9B3B — CIRLAINE
UPDATE public.veiculos SET status='instalacao_pendente'::status_veiculo, updated_at=now()
 WHERE id='ec0039cc-8803-4968-8c5e-7dc67480586f' AND status='em_analise';

-- FVW6H66 — EDUARDO FERNANDO
UPDATE public.associados SET status='aguardando_instalacao'::status_associado, updated_at=now()
 WHERE id='8e40ea0a-3a82-4788-970a-6cdd737c5dfd' AND status='em_analise';

-- HOA1B39 — VINICIUS
UPDATE public.associados SET status='aguardando_instalacao'::status_associado, updated_at=now()
 WHERE id='5955e32d-46e8-4fa1-ab15-c2cef4812aa9' AND status='em_analise';

-- Logs
INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, dados_novos) VALUES
('editar','monitoramento','associados','2300c0ca-9ce2-4a9d-bf65-9206fa0cc492',
 'Hotfix rebobinamento pós-instalação: status em_analise → aguardando_instalacao — LMP3D41 / MARCELO LESSA',
 jsonb_build_object('status','aguardando_instalacao','motivo','hotfix-rebobinados-26052026')),
('editar','monitoramento','veiculos','af315231-3767-4e05-bc03-fcdb67a85f80',
 'Hotfix rebobinamento pós-instalação: status em_analise → instalacao_pendente — LMP3D41',
 jsonb_build_object('status','instalacao_pendente','motivo','hotfix-rebobinados-26052026')),
('editar','monitoramento','veiculos','ec0039cc-8803-4968-8c5e-7dc67480586f',
 'Hotfix rebobinamento pós-instalação: status em_analise → instalacao_pendente — 0KMB9B3B / CIRLAINE',
 jsonb_build_object('status','instalacao_pendente','motivo','hotfix-rebobinados-26052026')),
('editar','monitoramento','associados','8e40ea0a-3a82-4788-970a-6cdd737c5dfd',
 'Hotfix rebobinamento pós-instalação: status em_analise → aguardando_instalacao — FVW6H66 / EDUARDO',
 jsonb_build_object('status','aguardando_instalacao','motivo','hotfix-rebobinados-26052026')),
('editar','monitoramento','associados','5955e32d-46e8-4fa1-ab15-c2cef4812aa9',
 'Hotfix rebobinamento pós-instalação: status em_analise → aguardando_instalacao — HOA1B39 / VINICIUS',
 jsonb_build_object('status','aguardando_instalacao','motivo','hotfix-rebobinados-26052026'));

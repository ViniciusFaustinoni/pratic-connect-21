-- Desvincula associado do contrato e desmarca em_troca antes de deletar
UPDATE public.associados SET contrato_id=NULL WHERE contrato_id IN ('571d8bc5-e56b-410f-ab8f-b5a8521dc2f7','13893972-b8a6-4b01-8ef4-9e34c30cbf45');
UPDATE public.veiculos SET em_troca_titularidade=false WHERE id='33dd5531-f99f-459f-bcec-1814b1445d25';

-- Limpa solicitação de troca
DELETE FROM public.solicitacoes_troca_titularidade WHERE veiculo_id='33dd5531-f99f-459f-bcec-1814b1445d25';

-- Desvincula rastreador (preserva o equipamento)
UPDATE public.rastreadores SET veiculo_id=NULL WHERE veiculo_id='33dd5531-f99f-459f-bcec-1814b1445d25';

-- Limpa dependências dos contratos
DELETE FROM public.contratos_historico WHERE contrato_id IN ('571d8bc5-e56b-410f-ab8f-b5a8521dc2f7','13893972-b8a6-4b01-8ef4-9e34c30cbf45');
DELETE FROM public.comissoes WHERE contrato_id IN ('571d8bc5-e56b-410f-ab8f-b5a8521dc2f7','13893972-b8a6-4b01-8ef4-9e34c30cbf45');
UPDATE public.cotacoes SET contrato_gerado_id=NULL WHERE contrato_gerado_id IN ('571d8bc5-e56b-410f-ab8f-b5a8521dc2f7','13893972-b8a6-4b01-8ef4-9e34c30cbf45');

-- Apaga contratos
DELETE FROM public.contratos WHERE id IN ('571d8bc5-e56b-410f-ab8f-b5a8521dc2f7','13893972-b8a6-4b01-8ef4-9e34c30cbf45');

-- Limpa restante de dependências do veículo
DELETE FROM public.documentos WHERE veiculo_id='33dd5531-f99f-459f-bcec-1814b1445d25';
DELETE FROM public.sga_sync_logs WHERE veiculo_id='33dd5531-f99f-459f-bcec-1814b1445d25';

-- Apaga o veículo
DELETE FROM public.veiculos WHERE id='33dd5531-f99f-459f-bcec-1814b1445d25';
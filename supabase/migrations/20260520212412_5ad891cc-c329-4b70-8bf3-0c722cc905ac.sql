
-- Limpeza completa da troca KOU6D37 (retry — respeitando FK)
DELETE FROM contratos_documentos
WHERE contrato_id = '71b21fd9-9aec-441c-bcbd-3d77fa0b0806'
   OR cotacao_id  = '440a2f3b-b336-474d-9dc4-26f81212238c';

-- Quebra FK cotacoes->contrato antes de apagar contrato
UPDATE cotacoes SET contrato_gerado_id = NULL
WHERE contrato_gerado_id = '71b21fd9-9aec-441c-bcbd-3d77fa0b0806';

DELETE FROM contratos WHERE id = '71b21fd9-9aec-441c-bcbd-3d77fa0b0806';
DELETE FROM cotacoes  WHERE id = '440a2f3b-b336-474d-9dc4-26f81212238c';
DELETE FROM solicitacoes_troca_titularidade WHERE id = 'dd250bcc-7c68-4bc4-b048-e1799ab8431f';
DELETE FROM associados WHERE id = '6c178885-a3c6-4da8-8774-c2836cba853f';

UPDATE veiculos
SET status = 'ativo', em_troca_titularidade = false, updated_at = now()
WHERE id = 'd5181403-22c0-4f2a-b22e-b6e7d821376c';

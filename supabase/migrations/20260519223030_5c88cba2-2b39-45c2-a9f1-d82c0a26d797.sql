
BEGIN;

CREATE TEMP TABLE _troca_reset_cotacoes AS
SELECT DISTINCT id FROM cotacoes
WHERE tipo_entrada = 'troca_titularidade'
   OR id IN (SELECT cotacao_id FROM solicitacoes_troca_titularidade WHERE cotacao_id IS NOT NULL);

CREATE TEMP TABLE _troca_reset_veiculos AS
SELECT DISTINCT veiculo_id AS id FROM solicitacoes_troca_titularidade WHERE veiculo_id IS NOT NULL
UNION
SELECT DISTINCT id FROM veiculos WHERE em_troca_titularidade = true;

DELETE FROM cotacoes_vistoria_fotos WHERE cotacao_id IN (SELECT id FROM _troca_reset_cotacoes);
DELETE FROM cotacoes_historico      WHERE cotacao_id IN (SELECT id FROM _troca_reset_cotacoes);

DELETE FROM contratos_documentos WHERE contrato_id IN (
  SELECT id FROM contratos
  WHERE cotacao_id IN (SELECT id FROM _troca_reset_cotacoes)
    AND status IN ('rascunho','pendente','enviado','visualizado','pendente_assinatura','assinado')
);
DELETE FROM contratos_historico WHERE contrato_id IN (
  SELECT id FROM contratos
  WHERE cotacao_id IN (SELECT id FROM _troca_reset_cotacoes)
    AND status IN ('rascunho','pendente','enviado','visualizado','pendente_assinatura','assinado')
);
DELETE FROM contratos
WHERE cotacao_id IN (SELECT id FROM _troca_reset_cotacoes)
  AND status IN ('rascunho','pendente','enviado','visualizado','pendente_assinatura','assinado');

DELETE FROM solicitacoes_troca_titularidade;
DELETE FROM cotacoes WHERE id IN (SELECT id FROM _troca_reset_cotacoes);

UPDATE veiculos
SET em_troca_titularidade = false,
    cobertura_suspensa = false,
    cobertura_suspensa_motivo = NULL,
    cobertura_suspensa_em = NULL
WHERE id IN (SELECT id FROM _troca_reset_veiculos);

DROP TABLE _troca_reset_cotacoes;
DROP TABLE _troca_reset_veiculos;

COMMIT;

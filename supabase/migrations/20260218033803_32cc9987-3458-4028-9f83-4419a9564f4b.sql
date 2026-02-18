
ALTER TABLE asaas_cobrancas DROP CONSTRAINT IF EXISTS asaas_cobrancas_tipo_check;
ALTER TABLE asaas_cobrancas ADD CONSTRAINT asaas_cobrancas_tipo_check
  CHECK (tipo IN ('mensalidade', 'adesao', 'servico', 'multa', 'outro', 'cota_participacao'));

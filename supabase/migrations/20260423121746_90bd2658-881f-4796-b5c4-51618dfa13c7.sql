ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS autentique_cancelamento_assinado_em timestamptz;
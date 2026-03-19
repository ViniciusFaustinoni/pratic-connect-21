ALTER TABLE substituicoes_veiculo
  ADD COLUMN IF NOT EXISTS tipo_atendimento VARCHAR(20) DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS valor_repasse NUMERIC DEFAULT 0;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS valor_adicional NUMERIC DEFAULT 0;

COMMENT ON COLUMN contratos.valor_adicional IS 'Valor adicional mensal (ex: cobertura extra, serviços opcionais)';
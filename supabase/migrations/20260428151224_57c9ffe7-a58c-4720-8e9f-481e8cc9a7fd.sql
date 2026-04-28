ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS veiculo_zero_km boolean,
  ADD COLUMN IF NOT EXISTS veiculo_ano_modelo integer;
ALTER TABLE veiculos
  ADD COLUMN IF NOT EXISTS flag_placa_vermelha boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_ex_taxi boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_taxi_ativo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_chassi_remarcado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_leilao boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_ex_ressarcido boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_avarias_vistoria boolean DEFAULT false;
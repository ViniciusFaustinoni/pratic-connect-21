ALTER TABLE public.cotacoes ADD COLUMN IF NOT EXISTS veiculo_motor TEXT;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS numero_motor TEXT;
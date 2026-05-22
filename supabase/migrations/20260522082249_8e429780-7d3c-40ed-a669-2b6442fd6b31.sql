ALTER TABLE public.substituicoes_veiculo
ADD COLUMN IF NOT EXISTS dia_vencimento smallint NULL
CHECK (dia_vencimento IS NULL OR dia_vencimento IN (5,10,15,20,25,30));
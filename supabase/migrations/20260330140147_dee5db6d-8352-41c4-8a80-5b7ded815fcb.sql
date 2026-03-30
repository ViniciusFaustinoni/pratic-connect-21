ALTER TABLE public.sinistros 
  ADD COLUMN IF NOT EXISTS data_comunicado date,
  ADD COLUMN IF NOT EXISTS envolvimento text,
  ADD COLUMN IF NOT EXISTS solicitou_carro_reserva boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_depreciacao numeric;

ALTER TABLE public.vistorias_evento
  ADD COLUMN IF NOT EXISTS permite_encaixe boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS endereco_latitude numeric,
  ADD COLUMN IF NOT EXISTS endereco_longitude numeric;

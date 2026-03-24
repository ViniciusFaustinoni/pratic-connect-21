ALTER TABLE public.instalacoes
  ADD COLUMN IF NOT EXISTS vistoriador_prestador_id uuid REFERENCES public.vistoriadores_prestadores(id),
  ADD COLUMN IF NOT EXISTS valor_prestador numeric(10,2),
  ADD COLUMN IF NOT EXISTS prestador_atribuido_em timestamptz;
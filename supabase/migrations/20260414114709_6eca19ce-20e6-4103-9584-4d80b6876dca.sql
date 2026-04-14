
ALTER TABLE public.product_lines
  ADD COLUMN IF NOT EXISTS disponivel_agente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agente_descricao text;

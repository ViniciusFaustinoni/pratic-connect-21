ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS cadastro_aprovado boolean NOT NULL DEFAULT false;

UPDATE public.contratos
   SET cadastro_aprovado = true
 WHERE aprovado_em IS NOT NULL
   AND cadastro_aprovado = false;

CREATE INDEX IF NOT EXISTS idx_contratos_status_cadastro_aprovado
  ON public.contratos (status)
  WHERE cadastro_aprovado = false;
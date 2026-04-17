ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agencia_forma_recebimento text NOT NULL DEFAULT 'comissao';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_agencia_forma_recebimento_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_agencia_forma_recebimento_check
  CHECK (agencia_forma_recebimento IN ('comissao','em_maos'));

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS adesao_isenta_agencia boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_contratos_adesao_isenta_agencia
  ON public.contratos(adesao_isenta_agencia) WHERE adesao_isenta_agencia = true;
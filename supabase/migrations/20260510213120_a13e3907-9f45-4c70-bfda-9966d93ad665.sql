ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS origem_troca_titularidade boolean NOT NULL DEFAULT false;

ALTER TABLE public.cotacoes
  DROP CONSTRAINT IF EXISTS cotacoes_prioridade_check;
ALTER TABLE public.cotacoes
  ADD CONSTRAINT cotacoes_prioridade_check
  CHECK (prioridade IN ('normal','alta','urgente'));

CREATE INDEX IF NOT EXISTS idx_cotacoes_prioridade
  ON public.cotacoes (prioridade)
  WHERE prioridade <> 'normal';

CREATE INDEX IF NOT EXISTS idx_cotacoes_origem_troca
  ON public.cotacoes (origem_troca_titularidade)
  WHERE origem_troca_titularidade = true;
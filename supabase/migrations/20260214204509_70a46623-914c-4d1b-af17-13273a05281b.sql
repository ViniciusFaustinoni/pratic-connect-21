
-- Novos status no enum status_sinistro
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_diretoria';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_juridico';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_confirmacoes';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'em_oficina';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_peca';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'em_finalizacao';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'concluido';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'entregue';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'finalizado';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_indenizacao';
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_pagamento';

-- Colunas de prazo de ressarcimento em sinistros
ALTER TABLE public.sinistros
  ADD COLUMN IF NOT EXISTS prazo_ressarcimento_inicio date,
  ADD COLUMN IF NOT EXISTS prazo_dias_uteis_consumidos integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_suspenso boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS prazo_suspenso_em timestamptz,
  ADD COLUMN IF NOT EXISTS prazo_motivo_suspensao text;

-- Tabela sinistro_suspensoes_prazo
CREATE TABLE IF NOT EXISTS public.sinistro_suspensoes_prazo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES public.sinistros(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  dias_uteis_suspensos integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sinistro_suspensoes_prazo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read suspensoes_prazo"
  ON public.sinistro_suspensoes_prazo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert suspensoes_prazo"
  ON public.sinistro_suspensoes_prazo
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update suspensoes_prazo"
  ON public.sinistro_suspensoes_prazo
  FOR UPDATE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_suspensoes_prazo_sinistro ON public.sinistro_suspensoes_prazo(sinistro_id);

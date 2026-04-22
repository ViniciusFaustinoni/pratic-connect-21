
DO $$ BEGIN
  CREATE TYPE public.cobranca_origem AS ENUM ('sistema', 'sga_hinova');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS origem public.cobranca_origem NOT NULL DEFAULT 'sistema',
  ADD COLUMN IF NOT EXISTS codigo_situacao_boleto_hinova integer,
  ADD COLUMN IF NOT EXISTS tipo_boleto_hinova text,
  ADD COLUMN IF NOT EXISTS dados_brutos_sga jsonb,
  ADD COLUMN IF NOT EXISTS sincronizado_sga_em timestamptz,
  ADD COLUMN IF NOT EXISTS data_vencimento_original date;

CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_nosso_numero_uniq
  ON public.cobrancas (nosso_numero)
  WHERE nosso_numero IS NOT NULL;

CREATE INDEX IF NOT EXISTS cobrancas_veiculo_status_venc_idx
  ON public.cobrancas (veiculo_id, status, data_vencimento);

CREATE INDEX IF NOT EXISTS cobrancas_origem_idx
  ON public.cobrancas (origem);

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS situacao_financeira_sga text,
  ADD COLUMN IF NOT EXISTS situacao_financeira_sga_em timestamptz,
  ADD COLUMN IF NOT EXISTS total_aberto_sga numeric(14,2),
  ADD COLUMN IF NOT EXISTS total_vencido_sga numeric(14,2);

CREATE TABLE IF NOT EXISTS public.sga_sync_financeiro_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  associado_id uuid REFERENCES public.associados(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('mapear_codigo','backfill_inicial','resync')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','executando','concluido','erro')),
  tentativas integer NOT NULL DEFAULT 0,
  ultimo_erro text,
  boletos_importados integer NOT NULL DEFAULT 0,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  agendado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sga_jobs_status_tipo_idx
  ON public.sga_sync_financeiro_jobs (status, tipo, agendado_em);

CREATE INDEX IF NOT EXISTS sga_jobs_veiculo_idx
  ON public.sga_sync_financeiro_jobs (veiculo_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='update_updated_at_column' AND pronamespace='public'::regnamespace) THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $f$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $f$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS sga_jobs_updated_at ON public.sga_sync_financeiro_jobs;
CREATE TRIGGER sga_jobs_updated_at
  BEFORE UPDATE ON public.sga_sync_financeiro_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sga_sync_financeiro_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sga_jobs_select_admin" ON public.sga_sync_financeiro_jobs;
CREATE POLICY "sga_jobs_select_admin"
  ON public.sga_sync_financeiro_jobs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_master'::app_role)
    OR public.has_role(auth.uid(), 'diretor'::app_role)
    OR public.has_role(auth.uid(), 'analista_cadastro'::app_role)
    OR public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
  );

DROP POLICY IF EXISTS "sga_jobs_insert_admin" ON public.sga_sync_financeiro_jobs;
CREATE POLICY "sga_jobs_insert_admin"
  ON public.sga_sync_financeiro_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_master'::app_role)
    OR public.has_role(auth.uid(), 'diretor'::app_role)
    OR public.has_role(auth.uid(), 'analista_cadastro'::app_role)
  );

DROP POLICY IF EXISTS "sga_jobs_update_admin" ON public.sga_sync_financeiro_jobs;
CREATE POLICY "sga_jobs_update_admin"
  ON public.sga_sync_financeiro_jobs
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_master'::app_role)
    OR public.has_role(auth.uid(), 'diretor'::app_role)
    OR public.has_role(auth.uid(), 'analista_cadastro'::app_role)
  );

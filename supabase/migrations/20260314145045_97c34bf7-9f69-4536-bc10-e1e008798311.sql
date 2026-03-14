
-- Enums
DO $$ BEGIN
  CREATE TYPE public.cc_tipo_lancamento AS ENUM ('credito', 'debito');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.cc_status_lancamento AS ENUM ('pendente', 'a_pagar', 'pago', 'antecipado', 'cancelado', 'em_abatimento');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Main table
CREATE TABLE IF NOT EXISTS public.cc_vendedor_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES public.profiles(id),
  associado_id uuid REFERENCES public.associados(id),
  contrato_id uuid REFERENCES public.contratos(id),
  tipo public.cc_tipo_lancamento NOT NULL,
  categoria text NOT NULL,
  descricao text NOT NULL,
  valor_bruto numeric(12,2) NOT NULL DEFAULT 0,
  valor_abatimento numeric(12,2) NOT NULL DEFAULT 0,
  valor_liquido numeric(12,2) NOT NULL DEFAULT 0,
  saldo_apos numeric(12,2),
  parcela_numero integer,
  parcela_total integer,
  debito_volante_ref_id uuid REFERENCES public.cc_vendedor_lancamentos(id),
  status public.cc_status_lancamento NOT NULL DEFAULT 'pendente',
  data_lancamento date NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento date,
  observacao_pagamento text,
  pago_por uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cc_vendedor ON public.cc_vendedor_lancamentos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_cc_associado ON public.cc_vendedor_lancamentos(associado_id);
CREATE INDEX IF NOT EXISTS idx_cc_status ON public.cc_vendedor_lancamentos(status);

-- RLS
ALTER TABLE public.cc_vendedor_lancamentos ENABLE ROW LEVEL SECURITY;

-- Helper function: get profile_id from auth uid (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_profile_id_for_auth(auth_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth_uid LIMIT 1;
$$;

-- Vendedor sees own entries (using user_id mapping)
CREATE POLICY "cc_vendedor_own_select" ON public.cc_vendedor_lancamentos
  FOR SELECT TO authenticated
  USING (vendedor_id = public.get_profile_id_for_auth(auth.uid()));

-- Admin/Diretor full access
CREATE POLICY "cc_admin_all" ON public.cc_vendedor_lancamentos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'admin_master')
  );

-- View for balance summary
CREATE OR REPLACE VIEW public.vw_cc_vendedor_saldo AS
SELECT
  vendedor_id,
  COALESCE(SUM(CASE WHEN tipo = 'credito' AND status NOT IN ('cancelado') THEN valor_liquido ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN tipo = 'debito' AND status NOT IN ('cancelado') THEN valor_liquido ELSE 0 END), 0) AS saldo_atual,
  COALESCE(SUM(CASE WHEN status = 'a_pagar' AND tipo = 'credito'
    AND EXTRACT(MONTH FROM data_lancamento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM data_lancamento) = EXTRACT(YEAR FROM CURRENT_DATE)
    THEN valor_liquido ELSE 0 END), 0) AS a_receber_mes,
  COALESCE(SUM(CASE WHEN status = 'antecipado' AND tipo = 'credito' THEN valor_liquido ELSE 0 END), 0) AS antecipacoes_abertas
FROM public.cc_vendedor_lancamentos
GROUP BY vendedor_id;

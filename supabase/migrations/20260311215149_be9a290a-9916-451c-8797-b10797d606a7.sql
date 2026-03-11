-- Table for dynamic category quotas per plan
CREATE TABLE public.planos_cotas_categoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  categoria_veiculo text NOT NULL,
  cota_percentual numeric(5,2) DEFAULT 6.0,
  cota_minima_valor numeric(10,2) DEFAULT 1200.00,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plano_id, categoria_veiculo)
);

ALTER TABLE public.planos_cotas_categoria ENABLE ROW LEVEL SECURITY;

-- Directors and admins can manage
CREATE POLICY "Gerencia pode gerenciar cotas categoria"
  ON public.planos_cotas_categoria
  FOR ALL
  TO authenticated
  USING (public.is_gerencia(auth.uid()))
  WITH CHECK (public.is_gerencia(auth.uid()));

-- Authenticated users can read
CREATE POLICY "Autenticados podem ler cotas categoria"
  ON public.planos_cotas_categoria
  FOR SELECT
  TO authenticated
  USING (true);

-- Add category-specific columns to faixas_cotas for actuarial grid
ALTER TABLE public.faixas_cotas
  ADD COLUMN IF NOT EXISTS cotas_passeio numeric(8,2),
  ADD COLUMN IF NOT EXISTS cotas_aplicativo numeric(8,2),
  ADD COLUMN IF NOT EXISTS cotas_moto numeric(8,2),
  ADD COLUMN IF NOT EXISTS cotas_diesel numeric(8,2),
  ADD COLUMN IF NOT EXISTS cotas_eletrico numeric(8,2);

COMMENT ON TABLE public.planos_cotas_categoria IS 'Cotas de participação dinâmicas por categoria de veículo para cada plano';
COMMENT ON COLUMN public.faixas_cotas.cotas_passeio IS 'Peso de cota específico para passeio nesta faixa FIPE';
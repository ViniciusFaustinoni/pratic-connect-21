-- Tabela para armazenar detalhes do rateio por faixa FIPE
CREATE TABLE IF NOT EXISTS public.rateios_detalhes_faixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rateio_id UUID NOT NULL REFERENCES public.rateios(id) ON DELETE CASCADE,
  faixa_id UUID NOT NULL REFERENCES public.faixas_cotas(id),
  fipe_de NUMERIC NOT NULL,
  fipe_ate NUMERIC NOT NULL,
  quantidade_cotas INTEGER NOT NULL,
  contratos_na_faixa INTEGER DEFAULT 0,
  total_cotas_faixa NUMERIC DEFAULT 0,
  ajuste_percentual NUMERIC DEFAULT 0,
  valor_base_cota NUMERIC NOT NULL,
  valor_final_cota NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_rateios_detalhes_faixas_rateio ON public.rateios_detalhes_faixas(rateio_id);
CREATE INDEX IF NOT EXISTS idx_rateios_detalhes_faixas_faixa ON public.rateios_detalhes_faixas(faixa_id);

-- Enable RLS
ALTER TABLE public.rateios_detalhes_faixas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Funcionários autenticados podem ver e inserir
CREATE POLICY "Funcionarios podem ver detalhes de rateio"
  ON public.rateios_detalhes_faixas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.tipo = 'funcionario'
    )
  );

CREATE POLICY "Funcionarios podem inserir detalhes de rateio"
  ON public.rateios_detalhes_faixas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.tipo = 'funcionario'
    )
  );
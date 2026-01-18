-- Tabela para armazenar exclusões de benefícios por categoria de veículo
CREATE TABLE IF NOT EXISTS public.benefit_category_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benefit_id UUID NOT NULL REFERENCES public.benefits(id) ON DELETE CASCADE,
  categoria_veiculo VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(benefit_id, categoria_veiculo)
);

-- Índices para performance
CREATE INDEX idx_benefit_category_exclusions_benefit 
  ON public.benefit_category_exclusions(benefit_id);
CREATE INDEX idx_benefit_category_exclusions_categoria 
  ON public.benefit_category_exclusions(categoria_veiculo);

-- Habilitar RLS
ALTER TABLE public.benefit_category_exclusions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Autenticados podem ver exclusões" 
  ON public.benefit_category_exclusions 
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Autenticados podem inserir exclusões" 
  ON public.benefit_category_exclusions 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Autenticados podem deletar exclusões" 
  ON public.benefit_category_exclusions 
  FOR DELETE 
  TO authenticated
  USING (true);

-- Migrar restrições existentes (incêndio para leilão, chassi remarcado, ressarcimento integral)
INSERT INTO public.benefit_category_exclusions (benefit_id, categoria_veiculo)
SELECT b.id, cat.categoria
FROM public.benefits b
CROSS JOIN (
  VALUES 
    ('leilao'), 
    ('chassi_remarcado'), 
    ('ressarcimento_integral')
) AS cat(categoria)
WHERE LOWER(b.name) LIKE '%incêndio%' 
   OR LOWER(b.name) LIKE '%incendio%'
ON CONFLICT DO NOTHING;

-- Tabela fila_servicos para gerenciar serviços aguardando profissionais ocupados
CREATE TABLE public.fila_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id UUID REFERENCES public.servicos(id) ON DELETE CASCADE NOT NULL,
  profissional_id UUID REFERENCES public.profiles(id) NOT NULL,
  distancia_km NUMERIC NOT NULL,
  prioridade INTEGER DEFAULT 0,
  status TEXT DEFAULT 'aguardando',
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '4 hours'),
  UNIQUE(servico_id, profissional_id)
);

ALTER TABLE public.fila_servicos ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users com canEditRotas podem ver
CREATE POLICY "Coordenadores podem ver fila" ON public.fila_servicos
  FOR SELECT TO authenticated
  USING (true);

-- Coluna imprevisto_origem na tabela servicos
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS imprevisto_origem TEXT;

-- Índices para performance
CREATE INDEX idx_fila_servicos_profissional_status ON public.fila_servicos(profissional_id, status);
CREATE INDEX idx_fila_servicos_servico ON public.fila_servicos(servico_id);
CREATE INDEX idx_servicos_imprevisto_origem ON public.servicos(imprevisto_origem) WHERE imprevisto_origem IS NOT NULL;

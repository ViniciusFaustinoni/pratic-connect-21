
-- Adicionar status 'entregue' ao enum status_ordem_servico
ALTER TYPE status_ordem_servico ADD VALUE IF NOT EXISTS 'entregue';

-- Tabela de atualizações diárias
CREATE TABLE IF NOT EXISTS public.os_atualizacoes_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid REFERENCES ordens_servico(id) NOT NULL,
  regulador_id uuid REFERENCES profiles(id) NOT NULL,
  descricao text NOT NULL,
  fotos_urls jsonb NOT NULL DEFAULT '[]',
  video_url text,
  etapa_concluida text,
  etapa_iniciada text,
  tem_problema boolean DEFAULT false,
  tipo_problema text,
  descricao_problema text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.os_atualizacoes_diarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage os_atualizacoes_diarias"
  ON public.os_atualizacoes_diarias
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Tabela de vistorias presenciais
CREATE TABLE IF NOT EXISTS public.os_vistorias_presenciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid REFERENCES ordens_servico(id) NOT NULL,
  regulador_id uuid REFERENCES profiles(id) NOT NULL,
  video_url text,
  latitude numeric,
  longitude numeric,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.os_vistorias_presenciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage os_vistorias_presenciais"
  ON public.os_vistorias_presenciais
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Colunas adicionais em ordens_servico
ALTER TABLE ordens_servico
  ADD COLUMN IF NOT EXISTS data_conclusao_real timestamptz,
  ADD COLUMN IF NOT EXISTS tempo_total_dias integer,
  ADD COLUMN IF NOT EXISTS token_retirada text,
  ADD COLUMN IF NOT EXISTS token_retirada_expira timestamptz,
  ADD COLUMN IF NOT EXISTS data_retirada timestamptz,
  ADD COLUMN IF NOT EXISTS garantia_ate date,
  ADD COLUMN IF NOT EXISTS assinatura_retirada_url text;

-- Índices
CREATE INDEX IF NOT EXISTS idx_os_atualizacoes_os_id ON os_atualizacoes_diarias(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_os_atualizacoes_created ON os_atualizacoes_diarias(created_at);
CREATE INDEX IF NOT EXISTS idx_os_vistorias_os_id ON os_vistorias_presenciais(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_os_token_retirada ON ordens_servico(token_retirada) WHERE token_retirada IS NOT NULL;

-- RLS para acesso anon à OS via token de retirada
CREATE POLICY "Anon can read OS by token_retirada"
  ON public.ordens_servico
  FOR SELECT
  USING (token_retirada IS NOT NULL AND token_retirada_expira > now());

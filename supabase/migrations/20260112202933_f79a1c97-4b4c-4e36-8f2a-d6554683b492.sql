-- Tabela: api_leads_config
CREATE TABLE public.api_leads_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- 'FORMULARIO' ou 'WEBHOOK'
  icone VARCHAR(50) DEFAULT 'link',
  cor VARCHAR(20) DEFAULT '#6b7280',
  ativo BOOLEAN DEFAULT FALSE,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  webhook_url TEXT,
  configuracoes JSONB DEFAULT '{}',
  leads_recebidos INTEGER DEFAULT 0,
  ultimo_lead_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: api_leads_logs
CREATE TABLE public.api_leads_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_config_id UUID REFERENCES public.api_leads_config(id) ON DELETE CASCADE,
  origem VARCHAR(100),
  payload JSONB,
  status VARCHAR(20) NOT NULL, -- 'SUCESSO', 'ERRO'
  erro TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ip_origem VARCHAR(50),
  tempo_resposta_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para performance
CREATE INDEX idx_api_leads_logs_config ON public.api_leads_logs(api_config_id);
CREATE INDEX idx_api_leads_logs_created ON public.api_leads_logs(created_at DESC);
CREATE INDEX idx_api_leads_logs_status ON public.api_leads_logs(status);
CREATE INDEX idx_api_leads_config_slug ON public.api_leads_config(slug);

-- RLS para api_leads_config
ALTER TABLE public.api_leads_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view api_leads_config"
ON public.api_leads_config
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Gerencia can manage api_leads_config"
ON public.api_leads_config
FOR ALL
TO authenticated
USING (is_gerencia(auth.uid()))
WITH CHECK (is_gerencia(auth.uid()));

-- RLS para api_leads_logs
ALTER TABLE public.api_leads_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view api_leads_logs"
ON public.api_leads_logs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can insert api_leads_logs"
ON public.api_leads_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Inserir integracoes padrao
INSERT INTO public.api_leads_config (nome, slug, tipo, icone, cor) VALUES
('Google Ads', 'google-ads', 'FORMULARIO', 'search', '#4285F4'),
('Facebook Ads', 'facebook-ads', 'FORMULARIO', 'facebook', '#1877F2'),
('Instagram', 'instagram', 'FORMULARIO', 'instagram', '#E4405F'),
('Site / Landing Page', 'site', 'WEBHOOK', 'globe', '#10b981'),
('WhatsApp API', 'whatsapp', 'WEBHOOK', 'message-circle', '#25D366'),
('RD Station', 'rd-station', 'WEBHOOK', 'zap', '#ff6b35'),
('Outro', 'outro', 'WEBHOOK', 'link', '#6b7280');

-- Trigger para updated_at
CREATE TRIGGER update_api_leads_config_updated_at
BEFORE UPDATE ON public.api_leads_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- 1. Adicionar 'api' como origem válida (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'api' AND enumtypid = 'origem_lead'::regtype) THEN
    ALTER TYPE origem_lead ADD VALUE 'api';
  END IF;
END$$;

-- 2. Criar tabela api_keys
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix VARCHAR(20) NOT NULL,
  ativa BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar tabela lead_fontes
CREATE TABLE public.lead_fontes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  vendedor_padrao_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  etapa_inicial etapa_lead DEFAULT 'novo',
  ativa BOOLEAN DEFAULT true,
  total_leads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Adicionar coluna fonte_id na tabela leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS fonte_id UUID REFERENCES public.lead_fontes(id) ON DELETE SET NULL;

-- 5. RLS para api_keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can manage API keys"
  ON public.api_keys FOR ALL
  USING (is_gerencia(auth.uid()));

-- 6. RLS para lead_fontes
ALTER TABLE public.lead_fontes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can manage lead sources"
  ON public.lead_fontes FOR ALL
  USING (is_gerencia(auth.uid()));

CREATE POLICY "Staff can view lead sources"
  ON public.lead_fontes FOR SELECT
  USING (is_funcionario(auth.uid()));

-- 7. Índices
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_lead_fontes_codigo ON public.lead_fontes(codigo);
CREATE INDEX idx_leads_fonte ON public.leads(fonte_id);

-- 8. Trigger para updated_at em lead_fontes
CREATE TRIGGER update_lead_fontes_updated_at
  BEFORE UPDATE ON public.lead_fontes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
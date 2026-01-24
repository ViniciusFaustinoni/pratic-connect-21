-- Tabela para armazenar subscriptions de push notifications dos profissionais
CREATE TABLE public.push_subscriptions_profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relacionamento com profissional (profiles.id)
  profissional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Dados da subscription Web Push
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  
  -- Metadados
  user_agent TEXT,
  device_type TEXT, -- 'android', 'ios', 'desktop'
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_push_subs_prof_id ON push_subscriptions_profissionais(profissional_id);
CREATE INDEX idx_push_subs_active ON push_subscriptions_profissionais(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX idx_push_subs_endpoint ON push_subscriptions_profissionais(endpoint);

-- Habilitar RLS
ALTER TABLE push_subscriptions_profissionais ENABLE ROW LEVEL SECURITY;

-- Profissionais podem ver suas próprias subscriptions
CREATE POLICY "Profissionais podem ver próprias subscriptions"
  ON push_subscriptions_profissionais FOR SELECT
  USING (profissional_id = auth.uid());

-- Profissionais podem inserir suas próprias subscriptions
CREATE POLICY "Profissionais podem inserir próprias subscriptions"
  ON push_subscriptions_profissionais FOR INSERT
  WITH CHECK (profissional_id = auth.uid());

-- Profissionais podem atualizar suas próprias subscriptions
CREATE POLICY "Profissionais podem atualizar próprias subscriptions"
  ON push_subscriptions_profissionais FOR UPDATE
  USING (profissional_id = auth.uid());

-- Profissionais podem deletar suas próprias subscriptions
CREATE POLICY "Profissionais podem deletar próprias subscriptions"
  ON push_subscriptions_profissionais FOR DELETE
  USING (profissional_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_push_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_push_subscription_updated_at
  BEFORE UPDATE ON push_subscriptions_profissionais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_push_subscription_updated_at();
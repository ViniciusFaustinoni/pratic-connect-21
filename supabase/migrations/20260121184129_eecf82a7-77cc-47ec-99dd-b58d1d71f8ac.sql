-- Tabela para preferências de alertas do rastreador por associado
CREATE TABLE IF NOT EXISTS public.rastreador_preferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  
  -- Alertas
  alerta_cerca_ativo BOOLEAN DEFAULT true,
  alerta_ignicao_ativo BOOLEAN DEFAULT false,
  alerta_velocidade_ativo BOOLEAN DEFAULT false,
  velocidade_limite INTEGER DEFAULT 80,
  
  -- Horário dos alertas
  horario_alerta VARCHAR(20) DEFAULT 'sempre',
  horario_inicio TIME DEFAULT '22:00',
  horario_fim TIME DEFAULT '06:00',
  
  -- Privacidade
  compartilhar_localizacao BOOLEAN DEFAULT true,
  dados_anonimos BOOLEAN DEFAULT true,
  
  -- Notificações extras
  novidades_promocoes BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(associado_id)
);

-- RLS
ALTER TABLE public.rastreador_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Associado gerencia suas preferências"
ON public.rastreador_preferencias FOR ALL
USING (
  associado_id IN (SELECT id FROM associados WHERE user_id = auth.uid())
)
WITH CHECK (
  associado_id IN (SELECT id FROM associados WHERE user_id = auth.uid())
);

-- Trigger para updated_at
CREATE TRIGGER update_rastreador_preferencias_updated_at
BEFORE UPDATE ON public.rastreador_preferencias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
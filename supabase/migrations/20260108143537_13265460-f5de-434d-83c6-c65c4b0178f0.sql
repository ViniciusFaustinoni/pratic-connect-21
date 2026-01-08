-- Criar tabela de preferências de notificações
CREATE TABLE public.notificacoes_preferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Tipo de usuário
  tipo_usuario VARCHAR(20) NOT NULL DEFAULT 'colaborador',
  
  -- Canais (ambos)
  push_ativo BOOLEAN DEFAULT true,
  email_ativo BOOLEAN DEFAULT true,
  
  -- Específico Associado
  whatsapp_ativo BOOLEAN DEFAULT false,
  whatsapp_horario_inicio TIME DEFAULT '08:00',
  whatsapp_horario_fim TIME DEFAULT '20:00',
  
  -- Categorias Associado
  notif_financeiro BOOLEAN DEFAULT true,
  notif_veiculo BOOLEAN DEFAULT true,
  notif_comunicados BOOLEAN DEFAULT true,
  
  -- Específico Colaborador
  email_resumo_diario BOOLEAN DEFAULT true,
  email_alertas_criticos BOOLEAN DEFAULT true,
  horario_resumo TIME DEFAULT '08:00',
  som_notificacao BOOLEAN DEFAULT true,
  
  -- Onboarding
  onboarding_completo BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.notificacoes_preferencias ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuarios veem suas preferencias" 
ON public.notificacoes_preferencias 
FOR SELECT 
USING (auth.uid() = usuario_id);

CREATE POLICY "Usuarios criam suas preferencias" 
ON public.notificacoes_preferencias 
FOR INSERT 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuarios atualizam suas preferencias" 
ON public.notificacoes_preferencias 
FOR UPDATE 
USING (auth.uid() = usuario_id);

-- Adicionar colunas na tabela notificacoes existente
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS icone VARCHAR(50);
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS categoria VARCHAR(30);
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS prioridade VARCHAR(10) DEFAULT 'media';
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS referencia_tipo VARCHAR(50);
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS referencia_id UUID;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS canal_sistema BOOLEAN DEFAULT true;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS canal_push BOOLEAN DEFAULT false;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS canal_whatsapp BOOLEAN DEFAULT false;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS canal_email BOOLEAN DEFAULT false;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS lida_em TIMESTAMPTZ;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notif_pref_usuario ON public.notificacoes_preferencias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_categoria ON public.notificacoes(categoria);
CREATE INDEX IF NOT EXISTS idx_notif_prioridade ON public.notificacoes(prioridade);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_notif_pref_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notificacoes_preferencias_updated_at
BEFORE UPDATE ON public.notificacoes_preferencias
FOR EACH ROW
EXECUTE FUNCTION public.update_notif_pref_updated_at();
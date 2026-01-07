-- =============================================
-- INTEGRAÇÃO WHATSAPP - EVOLUTION API
-- =============================================

-- 1. TABELA: whatsapp_instancias
-- Armazena configurações das instâncias WhatsApp
CREATE TABLE public.whatsapp_instancias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  nome VARCHAR(100) NOT NULL,
  instance_name VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT,
  
  -- Configuração
  api_url TEXT NOT NULL,
  
  -- Status
  status VARCHAR(30) DEFAULT 'disconnected' 
    CHECK (status IN ('disconnected', 'connecting', 'open', 'close', 'qrcode')),
  telefone VARCHAR(20),
  nome_perfil VARCHAR(255),
  foto_perfil TEXT,
  
  -- Webhook
  webhook_url TEXT,
  webhook_enabled BOOLEAN DEFAULT TRUE,
  webhook_events TEXT[] DEFAULT ARRAY['messages.upsert', 'messages.update', 'connection.update'],
  
  -- Controle
  principal BOOLEAN DEFAULT FALSE,
  ativa BOOLEAN DEFAULT TRUE,
  ultima_conexao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apenas uma instância principal
CREATE UNIQUE INDEX idx_whatsapp_principal ON public.whatsapp_instancias(principal) WHERE principal = TRUE;
CREATE INDEX idx_whatsapp_instancias_status ON public.whatsapp_instancias(status);
CREATE INDEX idx_whatsapp_instancias_ativa ON public.whatsapp_instancias(ativa);

-- RLS
ALTER TABLE public.whatsapp_instancias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem ver instancias whatsapp" 
  ON public.whatsapp_instancias
  FOR SELECT USING (am_i_funcionario());

CREATE POLICY "Gerencia pode gerenciar instancias whatsapp" 
  ON public.whatsapp_instancias
  FOR ALL USING (am_i_gerencia());

-- Instância padrão
INSERT INTO public.whatsapp_instancias (nome, instance_name, api_url, principal) 
VALUES ('Principal', 'sga-pratic', 'https://sua-evolution-api.com', TRUE);

-- 2. TABELA: whatsapp_mensagens
-- Log de todas as mensagens enviadas/recebidas
CREATE TABLE public.whatsapp_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Instância
  instancia_id UUID REFERENCES public.whatsapp_instancias(id) ON DELETE SET NULL,
  
  -- Destinatário
  telefone VARCHAR(20) NOT NULL,
  nome_contato VARCHAR(255),
  
  -- Conteúdo
  tipo VARCHAR(30) DEFAULT 'text' 
    CHECK (tipo IN ('text', 'image', 'document', 'audio', 'video', 'template')),
  mensagem TEXT,
  media_url TEXT,
  media_mimetype VARCHAR(100),
  media_filename VARCHAR(255),
  
  -- Template (se aplicável)
  template_id UUID,
  template_variaveis JSONB,
  
  -- Status
  status VARCHAR(30) DEFAULT 'pendente' 
    CHECK (status IN ('pendente', 'enviando', 'enviada', 'entregue', 'lida', 'erro', 'cancelada')),
  message_id VARCHAR(100),
  erro_codigo VARCHAR(50),
  erro_mensagem TEXT,
  
  -- Referência (de onde veio)
  referencia_tipo VARCHAR(50),
  referencia_id UUID,
  
  -- Controle
  direcao VARCHAR(10) DEFAULT 'saida' CHECK (direcao IN ('saida', 'entrada')),
  enviado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX idx_wpp_msg_telefone ON public.whatsapp_mensagens(telefone);
CREATE INDEX idx_wpp_msg_status ON public.whatsapp_mensagens(status);
CREATE INDEX idx_wpp_msg_referencia ON public.whatsapp_mensagens(referencia_tipo, referencia_id);
CREATE INDEX idx_wpp_msg_created ON public.whatsapp_mensagens(created_at DESC);
CREATE INDEX idx_wpp_msg_message_id ON public.whatsapp_mensagens(message_id);
CREATE INDEX idx_wpp_msg_instancia ON public.whatsapp_mensagens(instancia_id);

-- RLS
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem ver mensagens whatsapp" 
  ON public.whatsapp_mensagens
  FOR SELECT USING (am_i_funcionario());

CREATE POLICY "Funcionarios podem inserir mensagens whatsapp" 
  ON public.whatsapp_mensagens
  FOR INSERT WITH CHECK (am_i_funcionario());

CREATE POLICY "Funcionarios podem atualizar mensagens whatsapp" 
  ON public.whatsapp_mensagens
  FOR UPDATE USING (am_i_funcionario());

-- 3. TABELA: whatsapp_logs
-- Logs de eventos da Evolution API
CREATE TABLE public.whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id UUID REFERENCES public.whatsapp_instancias(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  evento VARCHAR(100),
  payload JSONB,
  resposta JSONB,
  erro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_wpp_logs_instancia ON public.whatsapp_logs(instancia_id);
CREATE INDEX idx_wpp_logs_created ON public.whatsapp_logs(created_at DESC);
CREATE INDEX idx_wpp_logs_tipo ON public.whatsapp_logs(tipo);

-- RLS
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem ver logs whatsapp" 
  ON public.whatsapp_logs
  FOR SELECT USING (am_i_funcionario());

-- Permitir inserção sem autenticação (para edge functions com service role)
CREATE POLICY "Sistema pode inserir logs whatsapp" 
  ON public.whatsapp_logs
  FOR INSERT WITH CHECK (true);

-- 4. TRIGGER: updated_at para whatsapp_instancias
CREATE TRIGGER update_whatsapp_instancias_updated_at
  BEFORE UPDATE ON public.whatsapp_instancias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.whatsapp_instancias IS 'Instâncias do WhatsApp via Evolution API';
COMMENT ON TABLE public.whatsapp_mensagens IS 'Log de mensagens WhatsApp enviadas e recebidas';
COMMENT ON TABLE public.whatsapp_logs IS 'Logs de eventos e chamadas à Evolution API';
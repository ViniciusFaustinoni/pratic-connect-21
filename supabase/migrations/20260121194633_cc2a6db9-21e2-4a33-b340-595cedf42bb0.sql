-- Tabela para tokens unificados de primeiro acesso e recuperação de senha
CREATE TABLE auth_tokens_app (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('primeiro_acesso', 'recuperar_senha')),
  codigo VARCHAR(6) NOT NULL,
  tentativas INTEGER DEFAULT 0,
  max_tentativas INTEGER DEFAULT 3,
  canal_envio VARCHAR(20) CHECK (canal_envio IN ('whatsapp', 'sms', 'email')),
  expira_em TIMESTAMPTZ NOT NULL,
  usado BOOLEAN DEFAULT false,
  usado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_solicitante TEXT
);

-- Índices para busca rápida
CREATE INDEX idx_auth_tokens_app_codigo ON auth_tokens_app(codigo, usado) WHERE usado = false;
CREATE INDEX idx_auth_tokens_app_associado ON auth_tokens_app(associado_id, tipo);
CREATE INDEX idx_auth_tokens_app_expira ON auth_tokens_app(expira_em) WHERE usado = false;

-- RLS
ALTER TABLE auth_tokens_app ENABLE ROW LEVEL SECURITY;

-- Apenas service role pode manipular tokens
CREATE POLICY "Service role only" ON auth_tokens_app
  FOR ALL USING (false);

-- Função para limpar tokens expirados
CREATE OR REPLACE FUNCTION fn_limpar_tokens_expirados()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth_tokens_app 
  WHERE expira_em < NOW() - INTERVAL '1 day';
END;
$$;

-- Adicionar campos de prioridade e categoria na tabela notificacoes se não existir
DO $$
BEGIN
  -- Adicionar subtipo se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notificacoes' AND column_name = 'subtipo'
  ) THEN
    ALTER TABLE notificacoes ADD COLUMN subtipo VARCHAR(50);
  END IF;
  
  -- Adicionar dados extras se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notificacoes' AND column_name = 'dados'
  ) THEN
    ALTER TABLE notificacoes ADD COLUMN dados JSONB;
  END IF;
END $$;

-- Índice para notificações por subtipo
CREATE INDEX IF NOT EXISTS idx_notificacoes_subtipo ON notificacoes(tipo, subtipo);

COMMENT ON TABLE auth_tokens_app IS 'Tokens para primeiro acesso e recuperação de senha do app do associado';
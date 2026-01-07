-- Tabela para controle de sessões
CREATE TABLE IF NOT EXISTS public.auth_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  tipo_dispositivo TEXT NOT NULL CHECK (tipo_dispositivo IN ('desktop', 'mobile')),
  ip INET,
  user_agent TEXT,
  navegador TEXT,
  sistema_operacional TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_acesso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_auth_sessoes_profile_id ON public.auth_sessoes(profile_id);
CREATE INDEX idx_auth_sessoes_token_hash ON public.auth_sessoes(token_hash);
CREATE INDEX idx_auth_sessoes_ativo ON public.auth_sessoes(ativo) WHERE ativo = true;

-- RLS
ALTER TABLE public.auth_sessoes ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver apenas suas próprias sessões
CREATE POLICY "Usuarios podem ver suas sessoes"
  ON public.auth_sessoes
  FOR SELECT
  USING (profile_id = get_current_profile_id());

-- Policy: Service role pode tudo (para Edge Functions)
CREATE POLICY "Service role full access"
  ON public.auth_sessoes
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comentário
COMMENT ON TABLE public.auth_sessoes IS 'Controle de sessões ativas por usuário e dispositivo';

-- Função para encerrar sessões quando usuário é desativado
CREATE OR REPLACE FUNCTION fn_encerrar_sessoes_usuario_desativado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Se usuário foi desativado ou bloqueado
  IF (OLD.ativo = true AND NEW.ativo = false) OR
     (OLD.bloqueado IS DISTINCT FROM NEW.bloqueado AND NEW.bloqueado = true) THEN
    
    -- Encerrar todas as sessões
    UPDATE auth_sessoes
    SET ativo = false
    WHERE profile_id = NEW.id;
    
    -- Registrar log
    INSERT INTO auth_logs (profile_id, email, acao, metadata)
    VALUES (
      NEW.id,
      NEW.email,
      'sessoes_encerradas_desativacao',
      jsonb_build_object('motivo', COALESCE(NEW.motivo_bloqueio, 'Usuário desativado'))
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para encerrar sessões ao desativar usuário
CREATE TRIGGER trg_encerrar_sessoes_desativacao
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_encerrar_sessoes_usuario_desativado();
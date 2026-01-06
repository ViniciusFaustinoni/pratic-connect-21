-- ═══════════════════════════════════════════════════════════════
-- MICRO-FRAÇÃO 1.2: Criar Tabela auth_logs para Auditoria
-- Adaptado ao schema existente (profiles em vez de usuarios)
-- ═══════════════════════════════════════════════════════════════

-- 1. CRIAR TABELA auth_logs
CREATE TABLE IF NOT EXISTS public.auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email TEXT,
  acao TEXT NOT NULL CHECK (acao IN (
    'login_sucesso',
    'login_falha',
    'logout',
    'usuario_criado',
    'senha_reset_solicitado',
    'senha_reset_concluido',
    'senha_alterada',
    'perfil_adicionado',
    'perfil_removido',
    'usuario_bloqueado',
    'usuario_desbloqueado',
    'sessao_expirada',
    'acesso_negado'
  )),
  ip_address INET,
  user_agent TEXT,
  dispositivo TEXT,
  navegador TEXT,
  sistema_operacional TEXT,
  pais TEXT,
  cidade TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_auth_logs_profile ON public.auth_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_acao ON public.auth_logs(acao);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created ON public.auth_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_email ON public.auth_logs(email);

-- 3. HABILITAR RLS
ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS RLS
-- Usuário vê seus próprios logs OU funcionários veem todos
CREATE POLICY "auth_logs_select_proprio_ou_funcionario" ON public.auth_logs
  FOR SELECT
  USING (
    profile_id = get_my_profile_id()
    OR am_i_funcionario()
  );

-- Qualquer usuário autenticado pode inserir logs
CREATE POLICY "auth_logs_insert_authenticated" ON public.auth_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. FUNÇÃO HELPER log_auth_event()
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_acao TEXT,
  p_email TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id UUID;
  v_profile_id UUID;
  v_email TEXT;
BEGIN
  -- Buscar profile_id do usuário logado (pode ser NULL se não logado)
  SELECT id, email INTO v_profile_id, v_email
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  INSERT INTO public.auth_logs (
    profile_id,
    email,
    acao,
    ip_address,
    user_agent,
    metadata,
    created_at
  ) VALUES (
    v_profile_id,
    COALESCE(p_email, v_email),
    p_acao,
    CASE WHEN p_ip IS NOT NULL THEN p_ip::inet ELSE NULL END,
    p_user_agent,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 6. DOCUMENTAÇÃO
COMMENT ON TABLE public.auth_logs IS 
  'Registro de todos os eventos de autenticação do sistema.
   Usado para auditoria, segurança e análise de comportamento.
   Relacionado com profiles via profile_id.
   Micro-fração: 1.2 - Tabela auth_logs';

COMMENT ON COLUMN public.auth_logs.profile_id IS 'FK para profiles.id - pode ser NULL para eventos antes do login';
COMMENT ON COLUMN public.auth_logs.acao IS 'Tipo de evento: login_sucesso, login_falha, logout, etc.';
COMMENT ON COLUMN public.auth_logs.metadata IS 'Dados adicionais em JSON (ex: provider, erro, tentativas)';
COMMENT ON COLUMN public.auth_logs.ip_address IS 'Endereço IP do cliente';
COMMENT ON COLUMN public.auth_logs.user_agent IS 'User-Agent do navegador/dispositivo';

COMMENT ON FUNCTION public.log_auth_event(TEXT, TEXT, TEXT, TEXT, JSONB) IS 
  'Registra um evento de autenticação na tabela auth_logs.
   Parâmetros: acao (obrigatório), email, ip, user_agent, metadata (opcionais).
   Retorna o UUID do log criado.
   Micro-fração: 1.2 - Tabela auth_logs';
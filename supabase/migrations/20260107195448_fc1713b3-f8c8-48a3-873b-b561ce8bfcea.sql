-- Tabela para registrar tentativas de login
CREATE TABLE IF NOT EXISTS public.auth_tentativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip INET,
  sucesso BOOLEAN NOT NULL DEFAULT false,
  motivo_falha TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX idx_auth_tentativas_email ON public.auth_tentativas(email);
CREATE INDEX idx_auth_tentativas_created_at ON public.auth_tentativas(created_at);
CREATE INDEX idx_auth_tentativas_email_sucesso ON public.auth_tentativas(email, sucesso);

-- Tabela para registrar bloqueios
CREATE TABLE IF NOT EXISTS public.auth_bloqueios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip INET,
  nivel INTEGER NOT NULL DEFAULT 1,
  bloqueado_ate TIMESTAMPTZ,
  bloqueio_permanente BOOLEAN NOT NULL DEFAULT false,
  motivo TEXT,
  desbloqueado_em TIMESTAMPTZ,
  desbloqueado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para bloqueios
CREATE INDEX idx_auth_bloqueios_email ON public.auth_bloqueios(email);
CREATE INDEX idx_auth_bloqueios_ativo ON public.auth_bloqueios(email) 
  WHERE desbloqueado_em IS NULL;

-- RLS para ambas tabelas
ALTER TABLE public.auth_tentativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_bloqueios ENABLE ROW LEVEL SECURITY;

-- Policy: Apenas service role (Edge Functions) pode acessar tentativas
CREATE POLICY "Service role full access tentativas"
  ON public.auth_tentativas FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Service role pode tudo em bloqueios
CREATE POLICY "Service role full access bloqueios"
  ON public.auth_bloqueios FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Supervisores podem ver bloqueios para gerenciar
CREATE POLICY "Supervisores podem ver bloqueios"
  ON public.auth_bloqueios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('diretor', 'gerente_comercial', 'supervisor_vendas')
    )
  );

-- Comentários
COMMENT ON TABLE public.auth_tentativas IS 'Log de tentativas de login (sucesso e falha)';
COMMENT ON TABLE public.auth_bloqueios IS 'Registro de bloqueios por tentativas excessivas';
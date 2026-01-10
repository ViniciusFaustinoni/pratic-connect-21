-- PARTE 2: Criar tabela e funções

-- 1. Criar função is_diretor se não existir
CREATE OR REPLACE FUNCTION public.is_diretor(_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'diretor'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Criar tabela de solicitações de permissão
CREATE TABLE IF NOT EXISTS solicitacoes_permissao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('alterar_permissao', 'adicionar_perfil', 'remover_perfil', 'criar_role')),
    solicitante_id UUID NOT NULL REFERENCES auth.users(id),
    usuario_alvo_id UUID REFERENCES auth.users(id),
    perfil_alvo VARCHAR(50),
    dados JSONB,
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'expirado')),
    aprovador_id UUID REFERENCES auth.users(id),
    motivo TEXT,
    motivo_rejeicao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    aprovado_em TIMESTAMPTZ,
    expira_em TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 3. Habilitar RLS
ALTER TABLE solicitacoes_permissao ENABLE ROW LEVEL SECURITY;

-- 4. Criar funções auxiliares
CREATE OR REPLACE FUNCTION public.is_desenvolvedor(_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'desenvolvedor'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin_master(_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin_master'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_permissions(_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('desenvolvedor', 'diretor', 'admin_master')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 5. Policies para solicitações
CREATE POLICY "Solicitantes veem suas próprias solicitações"
ON solicitacoes_permissao FOR SELECT TO authenticated
USING (solicitante_id = auth.uid());

CREATE POLICY "Aprovadores veem todas as solicitações pendentes"
ON solicitacoes_permissao FOR SELECT TO authenticated
USING (
    public.is_desenvolvedor(auth.uid()) OR
    public.is_diretor(auth.uid())
);

CREATE POLICY "Admin Master pode criar solicitações"
ON solicitacoes_permissao FOR INSERT TO authenticated
WITH CHECK (
    solicitante_id = auth.uid() AND
    public.can_manage_permissions(auth.uid())
);

CREATE POLICY "Aprovadores podem atualizar solicitações"
ON solicitacoes_permissao FOR UPDATE TO authenticated
USING (
    public.is_desenvolvedor(auth.uid()) OR
    public.is_diretor(auth.uid())
);

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes_permissao(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_solicitante ON solicitacoes_permissao(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_expira ON solicitacoes_permissao(expira_em) WHERE status = 'pendente';
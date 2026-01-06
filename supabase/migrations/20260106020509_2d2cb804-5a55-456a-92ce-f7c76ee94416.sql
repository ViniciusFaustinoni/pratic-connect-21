-- ═══════════════════════════════════════════════════════════════
-- MICRO-FRAÇÃO 1.0.1: Refinamento da Tabela profiles
-- SGA Pratic 2.0 — Módulo Autenticação e Controle de Acesso
-- ═══════════════════════════════════════════════════════════════

-- PARTE 1: Adicionar campos de segurança e auditoria
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_bloqueio VARCHAR(255),
  ADD COLUMN IF NOT EXISTS data_ultimo_acesso TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id);

-- PARTE 2: Criar função helper get_current_profile_id()
CREATE OR REPLACE FUNCTION public.get_current_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

COMMENT ON FUNCTION public.get_current_profile_id() IS 
  'Retorna o UUID do perfil do usuário logado (campo id da tabela profiles).
   Micro-fração: 1.0.1 do módulo de autenticação.';

-- PARTE 3: Criar índices de performance
CREATE INDEX IF NOT EXISTS idx_profiles_cpf 
  ON public.profiles(cpf) WHERE cpf IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_tipo 
  ON public.profiles(tipo);

CREATE INDEX IF NOT EXISTS idx_profiles_ativo 
  ON public.profiles(ativo) WHERE ativo = true;

-- Habilitar extensão pg_trgm para busca por similaridade
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice GIN para busca por nome
CREATE INDEX IF NOT EXISTS idx_profiles_nome_trgm 
  ON public.profiles USING gin(nome gin_trgm_ops);

-- PARTE 4: Adicionar comentários de documentação
COMMENT ON TABLE public.profiles IS 
  'Tabela CORE do sistema - Armazena perfis de todos os usuários (funcionários, associados, prestadores).
   Relacionada com auth.users via user_id.
   Módulo: Autenticação e Controle de Acesso.
   PRD: Seção 1.2.2 - Tabelas do Banco de Dados.';

COMMENT ON COLUMN public.profiles.id IS 
  'UUID primário do perfil. Gerado automaticamente via gen_random_uuid().
   Micro-fração: 1.0.1. Usado como FK em diversas tabelas do sistema.';

COMMENT ON COLUMN public.profiles.user_id IS 
  'FK para auth.users(id). Vincula o perfil ao usuário autenticado do Supabase.
   Micro-fração: 1.0.2.';

COMMENT ON COLUMN public.profiles.tipo IS 
  'Tipo do usuário no sistema: funcionario, associado, prestador.
   Usado nas funções helper is_funcionario() e is_associado().';

COMMENT ON COLUMN public.profiles.bloqueado IS 
  'Indica se o usuário está bloqueado. Se true, usuário não consegue fazer login.
   Requer motivo_bloqueio quando true.';

COMMENT ON COLUMN public.profiles.data_ultimo_acesso IS 
  'Data/hora do último acesso do usuário ao sistema.
   Atualizado automaticamente no login.';

-- PARTE 5: Função para atualizar último acesso
CREATE OR REPLACE FUNCTION public.update_last_access()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles 
  SET data_ultimo_acesso = NOW()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
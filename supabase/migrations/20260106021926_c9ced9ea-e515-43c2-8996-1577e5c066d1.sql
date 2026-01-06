-- ═══════════════════════════════════════════════════════════════
-- MICRO-FRAÇÃO 1.0.2: Funções Helper de Autenticação Aprimoradas
-- ═══════════════════════════════════════════════════════════════

-- 1. Atualizar is_funcionario para verificar ativo e bloqueado
CREATE OR REPLACE FUNCTION public.is_funcionario(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND tipo = 'funcionario'
      AND ativo = true
      AND (bloqueado IS NULL OR bloqueado = false)
  )
$$;

COMMENT ON FUNCTION public.is_funcionario(uuid) IS 
  'Retorna TRUE se o usuário é funcionário ativo e não bloqueado.
   Uso em RLS: is_funcionario(auth.uid())
   Micro-fração: 1.0.2';

-- 2. Atualizar is_associado para verificar ativo e bloqueado
CREATE OR REPLACE FUNCTION public.is_associado(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND tipo = 'associado'
      AND ativo = true
      AND (bloqueado IS NULL OR bloqueado = false)
  )
$$;

COMMENT ON FUNCTION public.is_associado(uuid) IS 
  'Retorna TRUE se o usuário é associado ativo e não bloqueado.
   Uso em RLS: is_associado(auth.uid())
   Micro-fração: 1.0.2';

-- 3. Criar is_prestador (não existia)
CREATE OR REPLACE FUNCTION public.is_prestador(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND tipo = 'prestador'
      AND ativo = true
      AND (bloqueado IS NULL OR bloqueado = false)
  )
$$;

COMMENT ON FUNCTION public.is_prestador(uuid) IS 
  'Retorna TRUE se o usuário é prestador ativo e não bloqueado.
   Uso em RLS: is_prestador(auth.uid())
   Micro-fração: 1.0.2';

-- 4. Atualizar has_role para verificar ativo e bloqueado via JOIN
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.profiles p ON ur.user_id = p.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND p.ativo = true
      AND (p.bloqueado IS NULL OR p.bloqueado = false)
  )
$$;

COMMENT ON FUNCTION public.has_role(uuid, app_role) IS 
  'Retorna TRUE se o usuário tem o role especificado E está ativo/não bloqueado.
   Uso em RLS: has_role(auth.uid(), ''diretor'')
   Micro-fração: 1.0.2';

-- 5. Atualizar is_gerencia para verificar bloqueio
CREATE OR REPLACE FUNCTION public.is_gerencia(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.profiles p ON ur.user_id = p.user_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('diretor', 'gerente_comercial')
      AND p.ativo = true
      AND (p.bloqueado IS NULL OR p.bloqueado = false)
  )
$$;

COMMENT ON FUNCTION public.is_gerencia(uuid) IS 
  'Retorna TRUE se o usuário é diretor ou gerente comercial ativo e não bloqueado.
   Micro-fração: 1.0.2';

-- 6. Atualizar is_vendedor para verificar bloqueio
CREATE OR REPLACE FUNCTION public.is_vendedor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.profiles p ON ur.user_id = p.user_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('vendedor_clt', 'vendedor_externo', 'supervisor_vendas')
      AND p.ativo = true
      AND (p.bloqueado IS NULL OR p.bloqueado = false)
  )
$$;

COMMENT ON FUNCTION public.is_vendedor(uuid) IS 
  'Retorna TRUE se o usuário é vendedor ativo e não bloqueado.
   Micro-fração: 1.0.2';

-- ═══════════════════════════════════════════════════════════════
-- FUNÇÕES WRAPPER (sem parâmetro - usam auth.uid() automaticamente)
-- ═══════════════════════════════════════════════════════════════

-- 7. get_my_tipo() - Retorna tipo do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_tipo()
RETURNS tipo_usuario
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT get_user_tipo(auth.uid())
$$;

COMMENT ON FUNCTION public.get_my_tipo() IS 
  'Retorna o tipo do usuário logado. Wrapper para get_user_tipo(auth.uid()).
   Micro-fração: 1.0.2';

-- 8. am_i_funcionario() - Verifica se sou funcionário
CREATE OR REPLACE FUNCTION public.am_i_funcionario()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT is_funcionario(auth.uid())
$$;

COMMENT ON FUNCTION public.am_i_funcionario() IS 
  'Retorna TRUE se o usuário logado é funcionário ativo e não bloqueado.
   Micro-fração: 1.0.2';

-- 9. am_i_associado() - Verifica se sou associado
CREATE OR REPLACE FUNCTION public.am_i_associado()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT is_associado(auth.uid())
$$;

COMMENT ON FUNCTION public.am_i_associado() IS 
  'Retorna TRUE se o usuário logado é associado ativo e não bloqueado.
   Micro-fração: 1.0.2';

-- 10. am_i_prestador() - Verifica se sou prestador
CREATE OR REPLACE FUNCTION public.am_i_prestador()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT is_prestador(auth.uid())
$$;

COMMENT ON FUNCTION public.am_i_prestador() IS 
  'Retorna TRUE se o usuário logado é prestador ativo e não bloqueado.
   Micro-fração: 1.0.2';

-- 11. am_i_gerencia() - Verifica se sou gerência
CREATE OR REPLACE FUNCTION public.am_i_gerencia()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT is_gerencia(auth.uid())
$$;

COMMENT ON FUNCTION public.am_i_gerencia() IS 
  'Retorna TRUE se o usuário logado é diretor ou gerente comercial.
   Micro-fração: 1.0.2';

-- 12. am_i_vendedor() - Verifica se sou vendedor
CREATE OR REPLACE FUNCTION public.am_i_vendedor()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT is_vendedor(auth.uid())
$$;

COMMENT ON FUNCTION public.am_i_vendedor() IS 
  'Retorna TRUE se o usuário logado é vendedor.
   Micro-fração: 1.0.2';
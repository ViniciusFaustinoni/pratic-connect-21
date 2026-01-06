-- ═══════════════════════════════════════════════════════════════
-- MICRO-FRAÇÃO 1.0.2: Atualizar Trigger handle_new_user
-- SGA Pratic 2.0 — Módulo Autenticação
-- ═══════════════════════════════════════════════════════════════

-- 1. ATUALIZAR FUNÇÃO handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_tipo tipo_usuario;
  user_nome TEXT;
  user_email TEXT;
  user_telefone TEXT;
  user_cpf TEXT;
  user_avatar TEXT;
BEGIN
  -- Extrair tipo do usuário (default: funcionario)
  user_tipo := COALESCE(
    (NEW.raw_user_meta_data->>'tipo')::tipo_usuario,
    'funcionario'
  );
  
  -- Extrair nome (múltiplas fontes possíveis)
  user_nome := COALESCE(
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Extrair email
  user_email := NEW.email;
  
  -- Extrair telefone (se fornecido no signup)
  user_telefone := NEW.raw_user_meta_data->>'telefone';
  
  -- Extrair CPF (se fornecido no signup)
  user_cpf := NEW.raw_user_meta_data->>'cpf';
  
  -- Extrair avatar (OAuth providers como Google)
  user_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  
  -- Inserir na tabela profiles
  INSERT INTO public.profiles (
    user_id,
    nome,
    email,
    telefone,
    cpf,
    tipo,
    ativo,
    avatar_url,
    bloqueado,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    user_nome,
    user_email,
    user_telefone,
    user_cpf,
    user_tipo,
    true,
    user_avatar,
    false,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  -- Se já existe profile para este user_id, apenas retorna
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 2. ADICIONAR COMENTÁRIO DE DOCUMENTAÇÃO
COMMENT ON FUNCTION public.handle_new_user() IS 
  'Trigger que cria automaticamente um registro em public.profiles 
   quando um novo usuário é criado no auth.users.
   
   Extrai metadados:
   - nome: raw_user_meta_data.nome/full_name/name ou email
   - tipo: raw_user_meta_data.tipo (default: funcionario)
   - telefone: raw_user_meta_data.telefone
   - cpf: raw_user_meta_data.cpf
   - avatar_url: raw_user_meta_data.avatar_url/picture (OAuth)
   
   Micro-fração: 1.0.2
   PRD: Seção 1.3 - Database Functions';
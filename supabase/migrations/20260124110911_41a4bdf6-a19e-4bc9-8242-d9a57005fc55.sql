-- =====================================================
-- CORREÇÃO: Sincronização de Perfis com Auth.Users
-- =====================================================

-- 1. Limpar TODAS as referências ao ID antigo
DELETE FROM rota_instaladores WHERE instalador_id = '64edb81d-a144-4f95-a490-017da710c478';
DELETE FROM vistoriadores_localizacao WHERE vistoriador_id = '64edb81d-a144-4f95-a490-017da710c478';
DELETE FROM user_roles WHERE user_id = '64edb81d-a144-4f95-a490-017da710c478';

-- Atualizar servicos que referenciam o ID antigo
UPDATE servicos SET profissional_id = NULL WHERE profissional_id = '64edb81d-a144-4f95-a490-017da710c478';
UPDATE instalacoes SET instalador_responsavel_id = NULL WHERE instalador_responsavel_id = '64edb81d-a144-4f95-a490-017da710c478';
UPDATE vistorias SET vistoriador_id = NULL WHERE vistoriador_id = '64edb81d-a144-4f95-a490-017da710c478';

-- Agora podemos deletar o profile antigo
DELETE FROM profiles WHERE id = '64edb81d-a144-4f95-a490-017da710c478';

-- 2. Garantir que o perfil existe com o ID correto do auth.users
-- O campo user_id também deve ser o mesmo ID (padrão do sistema onde id = user_id)
INSERT INTO profiles (id, user_id, email, nome, telefone, ativo, tipo, created_at, updated_at)
VALUES (
  '68f4857b-3499-4665-b73a-52d167df566a',
  '68f4857b-3499-4665-b73a-52d167df566a',
  'vistoriador@teste.com',
  '[TESTE] Vistoriador',
  '21992593830',
  true,
  'funcionario',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  email = EXCLUDED.email,
  nome = EXCLUDED.nome,
  telefone = EXCLUDED.telefone,
  ativo = true,
  updated_at = NOW();

-- 3. Criar role de instalador_vistoriador para o usuário de teste
INSERT INTO user_roles (user_id, role)
VALUES ('68f4857b-3499-4665-b73a-52d167df566a', 'instalador_vistoriador')
ON CONFLICT (user_id, role) DO NOTHING;

-- =====================================================
-- MELHORIA: Trigger handle_new_user com UPSERT
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Usar UPSERT para garantir que o perfil sempre existe e está sincronizado
  INSERT INTO public.profiles (id, user_id, email, nome, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'nome',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Garantir que o trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
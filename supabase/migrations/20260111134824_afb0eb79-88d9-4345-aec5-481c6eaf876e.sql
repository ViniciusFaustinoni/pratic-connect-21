-- ============================================
-- CORRIGIR FK: distribuicao_historico.vendedor_id
-- Deve referenciar auth.users.id (não profiles.id)
-- ============================================

-- Passo 1: Dropar constraint antiga de distribuicao_historico
ALTER TABLE distribuicao_historico 
DROP CONSTRAINT IF EXISTS distribuicao_historico_vendedor_id_fkey;

-- Passo 2: Tornar coluna nullable para evitar erros
ALTER TABLE distribuicao_historico 
ALTER COLUMN vendedor_id DROP NOT NULL;

-- Passo 3: Atualizar dados existentes (converter profile.id → user_id)
UPDATE distribuicao_historico dh
SET vendedor_id = p.user_id
FROM profiles p
WHERE dh.vendedor_id = p.id
  AND p.user_id IS NOT NULL;

-- Passo 4: Remover registros órfãos
DELETE FROM distribuicao_historico 
WHERE vendedor_id IS NOT NULL 
  AND vendedor_id NOT IN (SELECT id FROM auth.users);

-- Passo 5: Criar nova FK correta para distribuicao_historico
ALTER TABLE distribuicao_historico
ADD CONSTRAINT distribuicao_historico_vendedor_id_fkey 
FOREIGN KEY (vendedor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- CORRIGIR FK: distribuicao_vendedores.vendedor_id
-- ============================================

-- Passo 6: Dropar constraint antiga de distribuicao_vendedores
ALTER TABLE distribuicao_vendedores 
DROP CONSTRAINT IF EXISTS distribuicao_vendedores_vendedor_id_fkey;

-- Passo 7: Atualizar dados existentes (converter profile.id → user_id)
UPDATE distribuicao_vendedores dv
SET vendedor_id = p.user_id
FROM profiles p
WHERE dv.vendedor_id = p.id
  AND p.user_id IS NOT NULL;

-- Passo 8: Remover registros órfãos
DELETE FROM distribuicao_vendedores 
WHERE vendedor_id IS NOT NULL 
  AND vendedor_id NOT IN (SELECT id FROM auth.users);

-- Passo 9: Criar nova FK correta para distribuicao_vendedores
ALTER TABLE distribuicao_vendedores
ADD CONSTRAINT distribuicao_vendedores_vendedor_id_fkey 
FOREIGN KEY (vendedor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
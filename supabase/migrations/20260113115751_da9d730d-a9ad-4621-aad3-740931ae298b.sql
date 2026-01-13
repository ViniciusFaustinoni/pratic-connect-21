-- Corrigir Foreign Key: contratos.vendedor_id deve referenciar profiles, não auth.users

-- 1. Dropar constraints existentes
ALTER TABLE public.contratos 
DROP CONSTRAINT IF EXISTS contratos_vendedor_id_fkey;

ALTER TABLE public.contratos 
DROP CONSTRAINT IF EXISTS contratos_created_by_fkey;

-- 2. Recriar constraints apontando para profiles
ALTER TABLE public.contratos 
ADD CONSTRAINT contratos_vendedor_id_fkey 
FOREIGN KEY (vendedor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.contratos 
ADD CONSTRAINT contratos_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Garantir que as colunas sejam nullable (para evitar erros quando não há vendedor)
ALTER TABLE public.contratos 
ALTER COLUMN vendedor_id DROP NOT NULL;

ALTER TABLE public.contratos 
ALTER COLUMN created_by DROP NOT NULL;
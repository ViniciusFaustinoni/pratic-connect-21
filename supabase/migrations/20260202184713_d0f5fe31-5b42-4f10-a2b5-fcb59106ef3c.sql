-- Adicionar colunas whatsapp e full_name na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Atualizar full_name com valor de nome para registros existentes
UPDATE public.profiles 
SET full_name = nome 
WHERE full_name IS NULL AND nome IS NOT NULL;
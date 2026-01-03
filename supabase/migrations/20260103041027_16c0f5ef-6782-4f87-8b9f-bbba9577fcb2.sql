-- Adicionar campo avatar_url na tabela associados
ALTER TABLE public.associados 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;
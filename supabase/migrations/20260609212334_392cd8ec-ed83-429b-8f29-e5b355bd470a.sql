-- Adiciona enum 'relacionamento' (precisa ser em transação separada do uso)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'relacionamento';
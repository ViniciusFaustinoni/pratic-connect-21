ALTER TABLE public.vistoria_links
  ADD COLUMN IF NOT EXISTS iniciada_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS iniciada_por_nome text,
  ADD COLUMN IF NOT EXISTS fotos_executor_telefone text;

ALTER TABLE public.auto_centers ADD COLUMN IF NOT EXISTS inscricao_estadual text;
ALTER TABLE public.prestadores_evento ADD COLUMN IF NOT EXISTS inscricao_estadual text;

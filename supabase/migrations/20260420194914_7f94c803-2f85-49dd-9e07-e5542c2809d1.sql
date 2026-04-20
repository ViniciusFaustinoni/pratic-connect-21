-- Adicionar novos valores ao enum status_instalacao para refletir as fases reais
ALTER TYPE public.status_instalacao ADD VALUE IF NOT EXISTS 'atribuida';
ALTER TYPE public.status_instalacao ADD VALUE IF NOT EXISTS 'aguardando_prestador';
ALTER TYPE public.status_instalacao ADD VALUE IF NOT EXISTS 'no_local';
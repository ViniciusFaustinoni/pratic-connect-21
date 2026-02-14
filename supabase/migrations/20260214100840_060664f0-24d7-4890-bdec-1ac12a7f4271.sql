-- Add aguardando_analise to status_sinistro enum
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_analise';
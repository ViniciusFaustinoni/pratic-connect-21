-- Add pagamento_confirmado to status_sinistro enum
ALTER TYPE public.status_sinistro ADD VALUE IF NOT EXISTS 'pagamento_confirmado';

-- Add signature and payment tracking fields to sinistro_evento_links
ALTER TABLE public.sinistro_evento_links
  ADD COLUMN IF NOT EXISTS assinatura_url text,
  ADD COLUMN IF NOT EXISTS assinatura_ip text,
  ADD COLUMN IF NOT EXISTS assinatura_em timestamptz,
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_em timestamptz;
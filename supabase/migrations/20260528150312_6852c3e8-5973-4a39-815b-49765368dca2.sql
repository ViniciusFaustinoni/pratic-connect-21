ALTER TABLE public.email_suspensao_envios
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'resend',
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
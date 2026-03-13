ALTER TABLE public.whatsapp_meta_config
  ADD COLUMN IF NOT EXISTS last_webhook_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_webhook_event text,
  ADD COLUMN IF NOT EXISTS last_webhook_messages_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_webhook_statuses_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_webhook_error text;
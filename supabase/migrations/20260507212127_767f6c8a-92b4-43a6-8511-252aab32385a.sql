CREATE TABLE IF NOT EXISTS public.softruck_webhook_raw_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_origem TEXT,
  headers JSONB,
  raw_body TEXT,
  parse_error TEXT,
  status_resposta INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_softruck_webhook_raw_log_created ON public.softruck_webhook_raw_log(created_at DESC);

ALTER TABLE public.softruck_webhook_raw_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view raw webhook logs"
ON public.softruck_webhook_raw_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
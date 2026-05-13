
ALTER TABLE public.whatsapp_meta_templates
  ADD COLUMN IF NOT EXISTS enviar_por_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_assunto text,
  ADD COLUMN IF NOT EXISTS email_template_alias text;

CREATE TABLE IF NOT EXISTS public.notificacoes_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  referencia_tipo text,
  referencia_id text,
  params jsonb,
  resend_id text,
  status text NOT NULL DEFAULT 'pendente',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notificacoes_email_log_idem
  ON public.notificacoes_email_log (template_name, recipient_email, COALESCE(referencia_tipo,''), COALESCE(referencia_id,''))
  WHERE status = 'enviado';

CREATE INDEX IF NOT EXISTS notificacoes_email_log_recent
  ON public.notificacoes_email_log (created_at DESC);

ALTER TABLE public.notificacoes_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read email log" ON public.notificacoes_email_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'desenvolvedor'));

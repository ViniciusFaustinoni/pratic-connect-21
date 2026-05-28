
-- =====================================================
-- E-mails de Suspensão — estrutura (fase 1: UI apenas)
-- =====================================================

-- 1) Config (singleton)
CREATE TABLE public.email_suspensao_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_suspensao_config_singleton_check CHECK (singleton = true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_suspensao_config TO authenticated;
GRANT ALL ON public.email_suspensao_config TO service_role;

ALTER TABLE public.email_suspensao_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read email_suspensao_config"
  ON public.email_suspensao_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins insert email_suspensao_config"
  ON public.email_suspensao_config FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins update email_suspensao_config"
  ON public.email_suspensao_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins delete email_suspensao_config"
  ON public.email_suspensao_config FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE TRIGGER trg_email_suspensao_config_updated_at
  BEFORE UPDATE ON public.email_suspensao_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_suspensao_config (singleton, enabled) VALUES (true, false);


-- 2) Template (singleton)
CREATE TABLE public.email_suspensao_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  assunto text NOT NULL DEFAULT '',
  corpo text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_suspensao_template_singleton_check CHECK (singleton = true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_suspensao_template TO authenticated;
GRANT ALL ON public.email_suspensao_template TO service_role;

ALTER TABLE public.email_suspensao_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read email_suspensao_template"
  ON public.email_suspensao_template FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins insert email_suspensao_template"
  ON public.email_suspensao_template FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins update email_suspensao_template"
  ON public.email_suspensao_template FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins delete email_suspensao_template"
  ON public.email_suspensao_template FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE TRIGGER trg_email_suspensao_template_updated_at
  BEFORE UPDATE ON public.email_suspensao_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_suspensao_template (singleton, assunto, corpo) VALUES (
  true,
  'Sua conta na Praticcar foi suspensa',
  'Olá, {{nome_cliente}}.

Sua conta na Praticcar foi suspensa. Motivo: {{motivo_suspensao}}.

Para regularizar e reativar o serviço, entre em contato com nossa equipe pelo WhatsApp ou responda este e-mail. Estamos à disposição pra te ajudar.

Equipe Praticcar'
);


-- 3) Histórico de envios
CREATE TABLE public.email_suspensao_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome text,
  cliente_id uuid,
  destinatario text NOT NULL,
  fluxo_origem text,
  assunto_enviado text,
  corpo_renderizado text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','entregue','falhou')),
  erro_mensagem text,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_suspensao_envios TO authenticated;
GRANT ALL ON public.email_suspensao_envios TO service_role;

ALTER TABLE public.email_suspensao_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read email_suspensao_envios"
  ON public.email_suspensao_envios FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins insert email_suspensao_envios"
  ON public.email_suspensao_envios FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins update email_suspensao_envios"
  ON public.email_suspensao_envios FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins delete email_suspensao_envios"
  ON public.email_suspensao_envios FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE TRIGGER trg_email_suspensao_envios_updated_at
  BEFORE UPDATE ON public.email_suspensao_envios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_email_suspensao_envios_status ON public.email_suspensao_envios(status);
CREATE INDEX idx_email_suspensao_envios_fluxo ON public.email_suspensao_envios(fluxo_origem);
CREATE INDEX idx_email_suspensao_envios_enviado_em ON public.email_suspensao_envios(enviado_em DESC);
CREATE INDEX idx_email_suspensao_envios_destinatario ON public.email_suspensao_envios(destinatario);

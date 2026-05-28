
-- 1) Tabela de templates (múltiplos)
CREATE TABLE public.email_suspensao_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_key text NOT NULL UNIQUE,
  nome text NOT NULL,
  assunto text NOT NULL DEFAULT '',
  corpo text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT false,
  variaveis_disponiveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_suspensao_templates TO authenticated;
GRANT ALL ON public.email_suspensao_templates TO service_role;

ALTER TABLE public.email_suspensao_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read email_suspensao_templates"
  ON public.email_suspensao_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins insert email_suspensao_templates"
  ON public.email_suspensao_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins update email_suspensao_templates"
  ON public.email_suspensao_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins delete email_suspensao_templates"
  ON public.email_suspensao_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'diretor'));

CREATE TRIGGER trg_email_suspensao_templates_updated_at
  BEFORE UPDATE ON public.email_suspensao_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Envios: vínculo opcional ao template + novo status sem_email
ALTER TABLE public.email_suspensao_envios
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS template_key text;

ALTER TABLE public.email_suspensao_envios
  DROP CONSTRAINT IF EXISTS email_suspensao_envios_status_check;

ALTER TABLE public.email_suspensao_envios
  ADD CONSTRAINT email_suspensao_envios_status_check
  CHECK (status IN ('pendente','entregue','falhou','sem_email'));

CREATE INDEX IF NOT EXISTS idx_email_suspensao_envios_template_key
  ON public.email_suspensao_envios(template_key);

-- 3) Seed do template "Suspensão por não instalação"
INSERT INTO public.email_suspensao_templates
  (fluxo_key, nome, ativo, variaveis_disponiveis, assunto, corpo)
VALUES (
  'nao_instalacao',
  'Suspensão por não instalação',
  true,
  '[
    {"code":"{{nome_cliente}}","label":"Nome do cliente"},
    {"code":"{{placa}}","label":"Placa do veículo"},
    {"code":"{{prazo_horas}}","label":"Prazo do SLA em horas"}
  ]'::jsonb,
  'Prazo para instalação do rastreador expirado — Praticcar',
$body$Prezado(a) {{nome_cliente}},

Informamos que o prazo determinado para instalação do equipamento rastreador expirou. Necessitamos realizar a instalação no veículo de placa {{placa}} para seguir com a proteção do mesmo.

Desta forma, solicitamos que entre em contato com o setor de rastreamento o mais breve possível.

Ressaltamos que, conforme manual, item 3.4 (descrito abaixo), é estabelecido o prazo de até {{prazo_horas}} horas para disponibilizar o veículo para a instalação, sob pena de perda da proteção do seu veículo.

Item 3.4 — O associado deverá proceder no prazo de {{prazo_horas}} horas à instalação, sob pena de perda dos benefícios e, consequentemente, a sua exclusão do quadro de associados da PRATICCAR, assegurado o direito à ampla defesa e ao contraditório, consoante a cláusula 2.8.

Sem mais para o momento.

Equipe Praticcar$body$
)
ON CONFLICT (fluxo_key) DO NOTHING;

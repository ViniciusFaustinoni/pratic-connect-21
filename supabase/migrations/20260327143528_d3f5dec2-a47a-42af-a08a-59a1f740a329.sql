-- Tabela dinâmica de origens de lead
CREATE TABLE public.lead_origens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lead_origens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lead_origens"
  ON public.lead_origens FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage lead_origens"
  ON public.lead_origens FOR ALL TO authenticated
  USING (public.can_manage_users(auth.uid()))
  WITH CHECK (public.can_manage_users(auth.uid()));

-- Campo de detalhe na tabela leads
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS origem_detalhe_id UUID REFERENCES public.lead_origens(id);

-- Seed inicial
INSERT INTO public.lead_origens (nome, categoria) VALUES
  ('Instagram - Reels', 'instagram'),
  ('Instagram - Stories', 'instagram'),
  ('Instagram - Feed', 'instagram'),
  ('Facebook - Reels', 'facebook'),
  ('Facebook - Feed', 'facebook'),
  ('Meta Ads', 'facebook'),
  ('Google Ads', 'google'),
  ('Google Orgânico', 'google'),
  ('WhatsApp Direto', 'whatsapp'),
  ('Indicação de Associado', 'indicacao'),
  ('Presencial', 'presencial'),
  ('Telefone', 'telefone'),
  ('Site', 'site'),
  ('Parceiro', 'parceiro');
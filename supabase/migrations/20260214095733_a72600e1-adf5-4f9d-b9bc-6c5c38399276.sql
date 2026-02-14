
-- Add etapa4_completada_em to sinistro_evento_links
ALTER TABLE public.sinistro_evento_links 
ADD COLUMN IF NOT EXISTS etapa4_completada_em timestamptz;

-- Create vistorias_evento table
CREATE TABLE public.vistorias_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES public.sinistros(id) ON DELETE CASCADE,
  link_id uuid REFERENCES public.sinistro_evento_links(id),
  regulador_id uuid REFERENCES public.profiles(id),
  data_agendada date NOT NULL,
  horario_agendado time NOT NULL,
  endereco_rua text,
  endereco_numero text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_complemento text,
  status text NOT NULL DEFAULT 'agendada',
  dados_vistoria jsonb,
  iniciada_em timestamptz,
  concluida_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vistorias_evento ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Reguladores e gestores podem ver vistorias"
ON public.vistorias_evento FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'regulador') OR
  public.has_role(auth.uid(), 'diretor') OR
  public.has_role(auth.uid(), 'gerente_comercial') OR
  public.has_role(auth.uid(), 'analista_cadastro') OR
  public.has_role(auth.uid(), 'coordenador_monitoramento')
);

CREATE POLICY "Reguladores e gestores podem atualizar vistorias"
ON public.vistorias_evento FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'regulador') OR
  public.has_role(auth.uid(), 'diretor') OR
  public.has_role(auth.uid(), 'gerente_comercial')
);

CREATE POLICY "Service role pode inserir vistorias"
ON public.vistorias_evento FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_vistorias_evento_updated_at
BEFORE UPDATE ON public.vistorias_evento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_vistorias_evento_data ON public.vistorias_evento (data_agendada, horario_agendado);
CREATE INDEX idx_vistorias_evento_regulador ON public.vistorias_evento (regulador_id, status);
CREATE INDEX idx_vistorias_evento_sinistro ON public.vistorias_evento (sinistro_id);

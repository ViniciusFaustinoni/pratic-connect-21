
-- Tabela principal do parecer técnico do regulador
CREATE TABLE public.parecer_tecnico_regulador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES public.sinistros(id) ON DELETE CASCADE UNIQUE,
  vistoria_id uuid REFERENCES public.vistorias_evento(id) ON DELETE SET NULL,
  regulador_id uuid NOT NULL REFERENCES auth.users(id),
  gravidade text NOT NULL CHECK (gravidade IN ('leve', 'moderado', 'grave', 'possivel_perda_total')),
  descricao_tecnica text NOT NULL,
  prazo_estimado text CHECK (prazo_estimado IN ('ate_5_dias', '5_a_15', '15_a_30', '30_a_60', 'mais_60')),
  prazo_observacao text,
  observacoes_gerais text,
  recomendacao text CHECK (recomendacao IN ('seguir_reparo', 'segunda_avaliacao', 'avaliar_perda_total', 'pericia_tecnica')),
  estimativa_total numeric(12,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Itens estimados do parecer
CREATE TABLE public.parecer_tecnico_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parecer_id uuid NOT NULL REFERENCES public.parecer_tecnico_regulador(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('peca', 'servico')),
  descricao text NOT NULL,
  origem_sugerida text CHECK (origem_sugerida IN ('original', 'seminova', 'paralela', 'qualquer')),
  quantidade numeric DEFAULT 1,
  valor_estimado numeric(12,2) DEFAULT 0,
  prioridade text DEFAULT 'necessario' CHECK (prioridade IN ('essencial', 'necessario', 'opcional')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fotos técnicas do parecer
CREATE TABLE public.parecer_tecnico_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parecer_id uuid NOT NULL REFERENCES public.parecer_tecnico_regulador(id) ON DELETE CASCADE,
  arquivo_url text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_parecer_tecnico_sinistro ON public.parecer_tecnico_regulador(sinistro_id);
CREATE INDEX idx_parecer_tecnico_itens_parecer ON public.parecer_tecnico_itens(parecer_id);
CREATE INDEX idx_parecer_tecnico_fotos_parecer ON public.parecer_tecnico_fotos(parecer_id);

-- RLS
ALTER TABLE public.parecer_tecnico_regulador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parecer_tecnico_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parecer_tecnico_fotos ENABLE ROW LEVEL SECURITY;

-- SELECT: regulador, analista_eventos, diretor
CREATE POLICY "parecer_tecnico_select" ON public.parecer_tecnico_regulador FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'analista_eventos'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "parecer_tecnico_itens_select" ON public.parecer_tecnico_itens FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'analista_eventos'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "parecer_tecnico_fotos_select" ON public.parecer_tecnico_fotos FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'analista_eventos'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

-- INSERT/UPDATE: regulador, diretor
CREATE POLICY "parecer_tecnico_insert" ON public.parecer_tecnico_regulador FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "parecer_tecnico_update" ON public.parecer_tecnico_regulador FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "parecer_tecnico_itens_insert" ON public.parecer_tecnico_itens FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "parecer_tecnico_fotos_insert" ON public.parecer_tecnico_fotos FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

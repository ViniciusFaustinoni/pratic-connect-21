
-- Tabela caso_juridico_historico
CREATE TABLE public.caso_juridico_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id uuid REFERENCES public.consultas_juridicas(id) ON DELETE CASCADE,
  processo_id uuid REFERENCES public.processos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  usuario_id uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.caso_juridico_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read caso_juridico_historico"
ON public.caso_juridico_historico FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert caso_juridico_historico"
ON public.caso_juridico_historico FOR INSERT TO authenticated WITH CHECK (true);

-- Tabela caso_juridico_documentos
CREATE TABLE public.caso_juridico_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id uuid REFERENCES public.consultas_juridicas(id) ON DELETE CASCADE,
  processo_id uuid REFERENCES public.processos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  arquivo_url text NOT NULL,
  arquivo_nome text,
  tipo text DEFAULT 'outro',
  registrado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.caso_juridico_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read caso_juridico_documentos"
ON public.caso_juridico_documentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert caso_juridico_documentos"
ON public.caso_juridico_documentos FOR INSERT TO authenticated WITH CHECK (true);

-- Colunas de decisao em consultas_juridicas
ALTER TABLE public.consultas_juridicas
  ADD COLUMN IF NOT EXISTS decisao text,
  ADD COLUMN IF NOT EXISTS decisao_observacoes text,
  ADD COLUMN IF NOT EXISTS decisao_por uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS decisao_em timestamptz;

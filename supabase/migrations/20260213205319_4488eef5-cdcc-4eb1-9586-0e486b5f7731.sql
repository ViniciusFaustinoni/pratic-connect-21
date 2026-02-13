
-- Tabela auto_centers
CREATE TABLE public.auto_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  tipo TEXT NOT NULL DEFAULT 'auto_center',
  contato_nome TEXT,
  contato_telefone TEXT,
  contato_email TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela auto_center_pecas
CREATE TABLE public.auto_center_pecas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auto_center_id UUID NOT NULL REFERENCES public.auto_centers(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  valor NUMERIC,
  condicao TEXT NOT NULL DEFAULT 'novo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.auto_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_center_pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage auto_centers"
  ON public.auto_centers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage auto_center_pecas"
  ON public.auto_center_pecas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_auto_centers_updated_at
  BEFORE UPDATE ON public.auto_centers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

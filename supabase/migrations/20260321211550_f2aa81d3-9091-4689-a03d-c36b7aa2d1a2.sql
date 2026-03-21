
-- Function for updated_at (if not exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabela de comissão recorrente por plano e nível
CREATE TABLE public.comissao_plano_nivel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  nivel_nome TEXT NOT NULL,
  tipo_comissao TEXT NOT NULL DEFAULT 'valor_fixo',
  valor NUMERIC NOT NULL DEFAULT 0,
  parcelas INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plano_id, nivel_nome)
);

CREATE TRIGGER set_comissao_plano_nivel_updated_at
  BEFORE UPDATE ON public.comissao_plano_nivel
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_comissao_plano_nivel_plano ON public.comissao_plano_nivel(plano_id);

ALTER TABLE public.comissao_plano_nivel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read comissao_plano_nivel"
  ON public.comissao_plano_nivel FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Diretor/Admin can insert comissao_plano_nivel"
  ON public.comissao_plano_nivel FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'admin_master')
  );

CREATE POLICY "Diretor/Admin can update comissao_plano_nivel"
  ON public.comissao_plano_nivel FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'admin_master')
  );

CREATE POLICY "Diretor/Admin can delete comissao_plano_nivel"
  ON public.comissao_plano_nivel FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'admin_master')
  );

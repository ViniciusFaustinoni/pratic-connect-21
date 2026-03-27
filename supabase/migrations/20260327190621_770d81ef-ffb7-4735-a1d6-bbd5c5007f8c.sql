
CREATE TABLE public.planos_taxa_administrativa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  fipe_de NUMERIC(12,2) NOT NULL,
  fipe_ate NUMERIC(12,2) NOT NULL,
  valor_taxa NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_planos_taxa_admin_plano ON public.planos_taxa_administrativa(plano_id);

ALTER TABLE public.planos_taxa_administrativa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública taxa administrativa"
  ON public.planos_taxa_administrativa FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Insert taxa administrativa diretor"
  ON public.planos_taxa_administrativa FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'canManagePlans'));

CREATE POLICY "Update taxa administrativa diretor"
  ON public.planos_taxa_administrativa FOR UPDATE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'canManagePlans'))
  WITH CHECK (public.has_permission(auth.uid(), 'canManagePlans'));

CREATE POLICY "Delete taxa administrativa diretor"
  ON public.planos_taxa_administrativa FOR DELETE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'canManagePlans'));

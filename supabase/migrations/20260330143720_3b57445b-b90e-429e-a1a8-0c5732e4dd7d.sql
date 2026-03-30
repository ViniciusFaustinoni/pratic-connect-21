CREATE TABLE public.sinistro_coberturas_utilizadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES sinistros(id) ON DELETE CASCADE,
  cobertura_id uuid REFERENCES coberturas(id) ON DELETE SET NULL,
  benefit_id uuid REFERENCES benefits(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('cobertura', 'beneficio')),
  nome text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_referencia CHECK (cobertura_id IS NOT NULL OR benefit_id IS NOT NULL)
);

ALTER TABLE sinistro_coberturas_utilizadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_sinistro_coberturas" ON sinistro_coberturas_utilizadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sinistro_coberturas" ON sinistro_coberturas_utilizadas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sinistro_coberturas" ON sinistro_coberturas_utilizadas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sinistro_coberturas" ON sinistro_coberturas_utilizadas FOR DELETE TO authenticated USING (true);
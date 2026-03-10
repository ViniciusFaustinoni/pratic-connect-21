
CREATE TABLE IF NOT EXISTS faixas_producao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  placas_min integer NOT NULL,
  placas_max integer,
  valor_bonus numeric NOT NULL,
  descricao text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE faixas_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read faixas_producao" ON faixas_producao FOR SELECT TO authenticated USING (true);


CREATE TABLE public.locais_instalacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  tipo_veiculo text NOT NULL DEFAULT 'ambos',
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.locais_instalacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read" ON public.locais_instalacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert" ON public.locais_instalacao FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update" ON public.locais_instalacao FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.locais_instalacao (value, label, tipo_veiculo, ordem) VALUES
  ('painel', 'Painel', 'carro', 1),
  ('sob_banco', 'Sob o banco', 'ambos', 2),
  ('parachoque_dianteiro', 'Para-choque dianteiro', 'carro', 3),
  ('parachoque_traseiro', 'Para-choque traseiro', 'carro', 4),
  ('caixa_roda', 'Caixa de roda', 'carro', 5),
  ('vao_motor', 'Vão do motor', 'carro', 6),
  ('console_central', 'Console central', 'carro', 7),
  ('porta_malas', 'Porta-malas', 'carro', 8),
  ('carenagem_lateral', 'Carenagem lateral', 'moto', 9),
  ('caixa_filtro_ar', 'Caixa do filtro de ar', 'moto', 10),
  ('compartimento_ferramentas', 'Compartimento de ferramentas', 'moto', 11),
  ('sob_tanque', 'Sob o tanque', 'moto', 12),
  ('rabeta', 'Rabeta/Cola', 'moto', 13),
  ('paralama', 'Paralama', 'moto', 14),
  ('outro', 'Outro', 'ambos', 99);

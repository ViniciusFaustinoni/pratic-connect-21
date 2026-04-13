
CREATE TABLE public.aprovacoes_fipe_diretoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  diretor_id uuid NOT NULL REFERENCES auth.users(id),
  telefone text,
  status text NOT NULL DEFAULT 'pendente',
  respondido_em timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.aprovacoes_fipe_diretoria
  ADD CONSTRAINT uq_cotacao_diretor UNIQUE (cotacao_id, diretor_id);

ALTER TABLE public.aprovacoes_fipe_diretoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretores veem aprovacoes fipe diretoria"
  ON public.aprovacoes_fipe_diretoria
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Sistema insere aprovacoes fipe diretoria"
  ON public.aprovacoes_fipe_diretoria
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access aprovacoes fipe diretoria"
  ON public.aprovacoes_fipe_diretoria
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_aprov_fipe_dir_cotacao ON public.aprovacoes_fipe_diretoria(cotacao_id);
CREATE INDEX idx_aprov_fipe_dir_telefone ON public.aprovacoes_fipe_diretoria(telefone);

ALTER TABLE public.cotacoes ADD COLUMN IF NOT EXISTS fipe_diretoria_aprovado boolean DEFAULT null;

INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao, editavel) VALUES
  ('dupla_aprovacao_fipe_diretoria_ativa', 'false', 'booleano', 'regras_venda', 'Exigir dupla aprovação da diretoria para veículos acima do limite FIPE', true),
  ('dupla_aprovacao_fipe_minimo_votos', '2', 'numero', 'regras_venda', 'Número mínimo de aprovações necessárias da diretoria', true)
ON CONFLICT (chave) DO NOTHING;

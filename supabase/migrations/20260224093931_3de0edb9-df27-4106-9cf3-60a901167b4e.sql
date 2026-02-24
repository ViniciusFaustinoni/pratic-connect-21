
-- Tabela principal do orçamento vinculado ao sinistro
CREATE TABLE public.orcamento_reparo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES public.sinistros(id) ON DELETE CASCADE,
  oficina_id uuid REFERENCES public.oficinas(id),
  status text NOT NULL DEFAULT 'elaboracao' CHECK (status IN ('elaboracao', 'execucao', 'consolidado')),
  valor_inicial_total numeric(12,2) DEFAULT 0,
  valor_pecas numeric(12,2) DEFAULT 0,
  valor_mao_obra numeric(12,2) DEFAULT 0,
  valor_total numeric(12,2) DEFAULT 0,
  consolidado_em timestamptz,
  consolidado_por uuid REFERENCES auth.users(id),
  observacao_final text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orcamento_reparo_sinistro_unique UNIQUE (sinistro_id)
);

-- Itens do orçamento
CREATE TABLE public.orcamento_reparo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamento_reparo(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('peca', 'mao_de_obra')),
  descricao text NOT NULL,
  origem text CHECK (origem IN ('original', 'seminova', 'paralela')),
  quantidade numeric NOT NULL DEFAULT 1,
  valor_unitario numeric(12,2) NOT NULL DEFAULT 0,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'comprado', 'instalado', 'cancelado')),
  observacao text,
  motivo_inclusao text,
  motivo_cancelamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Histórico de alterações
CREATE TABLE public.orcamento_reparo_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamento_reparo(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.orcamento_reparo_itens(id) ON DELETE SET NULL,
  acao text NOT NULL,
  descricao text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  motivo text,
  usuario_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_orcamento_reparo_sinistro ON public.orcamento_reparo(sinistro_id);
CREATE INDEX idx_orcamento_reparo_itens_orcamento ON public.orcamento_reparo_itens(orcamento_id);
CREATE INDEX idx_orcamento_reparo_historico_orcamento ON public.orcamento_reparo_historico(orcamento_id);

-- RLS
ALTER TABLE public.orcamento_reparo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_reparo_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_reparo_historico ENABLE ROW LEVEL SECURITY;

-- SELECT policies
CREATE POLICY "orcamento_reparo_select" ON public.orcamento_reparo FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'analista_eventos'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "orcamento_reparo_itens_select" ON public.orcamento_reparo_itens FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'analista_eventos'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "orcamento_reparo_historico_select" ON public.orcamento_reparo_historico FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'analista_eventos'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

-- INSERT/UPDATE policies for orcamento_reparo
CREATE POLICY "orcamento_reparo_insert" ON public.orcamento_reparo FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'analista_eventos'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "orcamento_reparo_update" ON public.orcamento_reparo FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

-- INSERT/UPDATE policies for itens
CREATE POLICY "orcamento_reparo_itens_insert" ON public.orcamento_reparo_itens FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "orcamento_reparo_itens_update" ON public.orcamento_reparo_itens FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

-- INSERT policy for historico
CREATE POLICY "orcamento_reparo_historico_insert" ON public.orcamento_reparo_historico FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'regulador'::app_role) OR
    public.has_role(auth.uid(), 'analista_eventos'::app_role) OR
    public.has_role(auth.uid(), 'diretor'::app_role)
  );

-- Trigger: calcular valor_total do item
CREATE OR REPLACE FUNCTION public.calc_orcamento_item_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.valor_total := NEW.quantidade * NEW.valor_unitario;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calc_item_total
  BEFORE INSERT OR UPDATE ON public.orcamento_reparo_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.calc_orcamento_item_total();

-- Trigger: recalcular totais do orçamento pai
CREATE OR REPLACE FUNCTION public.recalc_orcamento_totais()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orcamento_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_orcamento_id := OLD.orcamento_id;
  ELSE
    v_orcamento_id := NEW.orcamento_id;
  END IF;

  UPDATE public.orcamento_reparo SET
    valor_pecas = COALESCE((
      SELECT SUM(valor_total) FROM public.orcamento_reparo_itens
      WHERE orcamento_id = v_orcamento_id AND tipo = 'peca' AND status != 'cancelado'
    ), 0),
    valor_mao_obra = COALESCE((
      SELECT SUM(valor_total) FROM public.orcamento_reparo_itens
      WHERE orcamento_id = v_orcamento_id AND tipo = 'mao_de_obra' AND status != 'cancelado'
    ), 0),
    valor_total = COALESCE((
      SELECT SUM(valor_total) FROM public.orcamento_reparo_itens
      WHERE orcamento_id = v_orcamento_id AND status != 'cancelado'
    ), 0),
    updated_at = now()
  WHERE id = v_orcamento_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalc_totais
  AFTER INSERT OR UPDATE OR DELETE ON public.orcamento_reparo_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_orcamento_totais();

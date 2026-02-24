
-- Parte 1: Adicionar colunas de pacote fechado na tabela orcamento_reparo
ALTER TABLE public.orcamento_reparo ADD COLUMN IF NOT EXISTS tipo_orcamento text DEFAULT 'cotacao_separada';
ALTER TABLE public.orcamento_reparo ADD CONSTRAINT orcamento_reparo_tipo_check CHECK (tipo_orcamento IN ('cotacao_separada', 'pacote_fechado'));

ALTER TABLE public.orcamento_reparo ADD COLUMN IF NOT EXISTS valor_pacote numeric(12,2);
ALTER TABLE public.orcamento_reparo ADD COLUMN IF NOT EXISTS descricao_pacote text;
ALTER TABLE public.orcamento_reparo ADD COLUMN IF NOT EXISTS prazo_estimado_dias integer;
ALTER TABLE public.orcamento_reparo ADD COLUMN IF NOT EXISTS forma_pagamento text;
ALTER TABLE public.orcamento_reparo ADD COLUMN IF NOT EXISTS observacao_negociacao text;
ALTER TABLE public.orcamento_reparo ADD COLUMN IF NOT EXISTS detalhamento_pacote jsonb;

-- Parte 2: Tabela de cotações de peças (Caminho 1)
CREATE TABLE IF NOT EXISTS public.orcamento_reparo_cotacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES public.orcamento_reparo_itens(id) ON DELETE CASCADE,
  fornecedor text NOT NULL,
  tipo_peca text CHECK (tipo_peca IN ('original', 'seminova', 'paralela')),
  valor numeric(12,2),
  prazo_entrega text,
  observacao text,
  selecionada boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orcamento_cotacoes_item_id ON public.orcamento_reparo_cotacoes(item_id);

-- RLS para cotações
ALTER TABLE public.orcamento_reparo_cotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cotacoes: select para regulador, analista, diretor"
  ON public.orcamento_reparo_cotacoes FOR SELECT
  USING (
    public.has_role(auth.uid(), 'regulador') OR
    public.has_role(auth.uid(), 'analista_eventos') OR
    public.has_role(auth.uid(), 'diretor')
  );

CREATE POLICY "Cotacoes: insert para regulador, analista, diretor"
  ON public.orcamento_reparo_cotacoes FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'regulador') OR
    public.has_role(auth.uid(), 'analista_eventos') OR
    public.has_role(auth.uid(), 'diretor')
  );

CREATE POLICY "Cotacoes: update para regulador, analista, diretor"
  ON public.orcamento_reparo_cotacoes FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'regulador') OR
    public.has_role(auth.uid(), 'analista_eventos') OR
    public.has_role(auth.uid(), 'diretor')
  );

CREATE POLICY "Cotacoes: delete para regulador, analista, diretor"
  ON public.orcamento_reparo_cotacoes FOR DELETE
  USING (
    public.has_role(auth.uid(), 'regulador') OR
    public.has_role(auth.uid(), 'analista_eventos') OR
    public.has_role(auth.uid(), 'diretor')
  );

-- Add auto_center_id and confirmation fields to orcamento_reparo_itens
ALTER TABLE public.orcamento_reparo_itens
  ADD COLUMN IF NOT EXISTS auto_center_id uuid REFERENCES public.auto_centers(id),
  ADD COLUMN IF NOT EXISTS valor_confirmado numeric,
  ADD COLUMN IF NOT EXISTS confirmado_por uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz;

-- Add custo_real_total to sinistros (only set when repair is concluded)
ALTER TABLE public.sinistros
  ADD COLUMN IF NOT EXISTS tipo_servico_oficina text DEFAULT 'servico_comum',
  ADD COLUMN IF NOT EXISTS custo_real_total numeric;

-- Add confirmation status to orcamento_reparo
ALTER TABLE public.orcamento_reparo
  ADD COLUMN IF NOT EXISTS confirmado_analista boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmado_analista_por uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS confirmado_analista_em timestamptz;
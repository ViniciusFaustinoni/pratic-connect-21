
-- Nova tabela para controle de aprovações de FIPE menor
CREATE TABLE public.aprovacoes_fipe_menor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  solicitante_id uuid NOT NULL REFERENCES auth.users(id),
  supervisor_id uuid REFERENCES auth.users(id),
  fipe_real numeric NOT NULL,
  fipe_faixa_original_min numeric NOT NULL,
  fipe_faixa_original_max numeric NOT NULL,
  fipe_faixa_solicitada_min numeric NOT NULL,
  fipe_faixa_solicitada_max numeric NOT NULL,
  valor_mensal_original numeric NOT NULL,
  valor_mensal_reduzido numeric NOT NULL,
  justificativa text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  observacao_supervisor text,
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Novas colunas na tabela cotacoes
ALTER TABLE public.cotacoes 
  ADD COLUMN IF NOT EXISTS solicitar_fipe_menor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fipe_menor_aprovado boolean,
  ADD COLUMN IF NOT EXISTS fipe_faixa_cobranca_min numeric,
  ADD COLUMN IF NOT EXISTS fipe_faixa_cobranca_max numeric;

-- RLS
ALTER TABLE public.aprovacoes_fipe_menor ENABLE ROW LEVEL SECURITY;

-- Vendedores veem suas próprias solicitações
CREATE POLICY "Vendedores veem proprias solicitacoes FIPE menor"
  ON public.aprovacoes_fipe_menor FOR SELECT
  TO authenticated
  USING (solicitante_id = auth.uid());

-- Supervisores/diretores veem todas
CREATE POLICY "Supervisores veem todas solicitacoes FIPE menor"
  ON public.aprovacoes_fipe_menor FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('diretor', 'admin_master', 'supervisor_vendas', 'gerente_comercial')
    )
  );

-- Vendedores podem inserir
CREATE POLICY "Vendedores podem criar solicitacao FIPE menor"
  ON public.aprovacoes_fipe_menor FOR INSERT
  TO authenticated
  WITH CHECK (solicitante_id = auth.uid());

-- Supervisores podem atualizar (aprovar/recusar)
CREATE POLICY "Supervisores podem atualizar solicitacoes FIPE menor"
  ON public.aprovacoes_fipe_menor FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('diretor', 'admin_master', 'supervisor_vendas', 'gerente_comercial')
    )
  );

-- Índices
CREATE INDEX idx_aprovacoes_fipe_menor_cotacao ON public.aprovacoes_fipe_menor(cotacao_id);
CREATE INDEX idx_aprovacoes_fipe_menor_status ON public.aprovacoes_fipe_menor(status);
CREATE INDEX idx_aprovacoes_fipe_menor_solicitante ON public.aprovacoes_fipe_menor(solicitante_id);

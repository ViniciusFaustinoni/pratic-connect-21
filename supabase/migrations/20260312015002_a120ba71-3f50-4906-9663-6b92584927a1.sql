
-- Tabela de aprovações de elegibilidade (padrão aprovacoes_fipe_menor)
CREATE TABLE public.aprovacoes_elegibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid REFERENCES public.cotacoes(id) ON DELETE CASCADE NOT NULL,
  plano_id uuid REFERENCES public.planos(id) ON DELETE CASCADE NOT NULL,
  solicitante_id uuid NOT NULL,
  marca text NOT NULL,
  modelo text NOT NULL,
  ano integer NOT NULL,
  combustivel text NOT NULL DEFAULT 'flex',
  placa text,
  motivo_bloqueio text NOT NULL DEFAULT 'negado',
  observacao_regra text,
  justificativa text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
  aprovador_id uuid,
  observacao_aprovador text,
  respondido_em timestamptz,
  supervisor_check boolean NOT NULL DEFAULT false,
  supervisor_id uuid,
  supervisor_check_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aprovacoes_elegibilidade ENABLE ROW LEVEL SECURITY;

-- RLS: autenticados podem ler (consultor vê as próprias, gestão vê todas via permissão)
CREATE POLICY "Users can read own aprovacoes_elegibilidade"
  ON public.aprovacoes_elegibilidade
  FOR SELECT TO authenticated
  USING (
    solicitante_id = auth.uid()
    OR public.has_permission(auth.uid(), 'canApproveElegibilidade')
    OR public.has_permission(auth.uid(), 'canViewElegibilidadePendente')
  );

-- Consultor pode inserir
CREATE POLICY "Authenticated can insert aprovacoes_elegibilidade"
  ON public.aprovacoes_elegibilidade
  FOR INSERT TO authenticated
  WITH CHECK (solicitante_id = auth.uid());

-- Gestão pode atualizar (aprovar/recusar/double-check)
CREATE POLICY "Management can update aprovacoes_elegibilidade"
  ON public.aprovacoes_elegibilidade
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), 'canApproveElegibilidade')
    OR public.has_permission(auth.uid(), 'canViewElegibilidadePendente')
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'canApproveElegibilidade')
    OR public.has_permission(auth.uid(), 'canViewElegibilidadePendente')
  );

-- Index para queries frequentes
CREATE INDEX idx_aprovacoes_elegibilidade_cotacao ON public.aprovacoes_elegibilidade(cotacao_id);
CREATE INDEX idx_aprovacoes_elegibilidade_status ON public.aprovacoes_elegibilidade(status);
CREATE INDEX idx_aprovacoes_elegibilidade_solicitante ON public.aprovacoes_elegibilidade(solicitante_id);

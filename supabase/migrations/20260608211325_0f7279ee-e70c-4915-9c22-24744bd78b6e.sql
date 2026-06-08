-- Tabela canônica do 4º destino do bypass: aba "Bypass Troca" em Comercial › Aprovações.
-- Não-bloqueante; apenas ciência por quem tem acesso à página /vendas/aprovacoes-fipe.

CREATE TABLE IF NOT EXISTS public.aprovacoes_bypass_troca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('bypass_janela', 'troca_convertida_cotacao')),
  status text NOT NULL DEFAULT 'ciente_pendente' CHECK (status IN ('ciente_pendente', 'ciente')),
  solicitacao_troca_id uuid REFERENCES public.solicitacoes_troca_titularidade(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  cotacao_id uuid REFERENCES public.cotacoes(id) ON DELETE SET NULL,
  associado_id uuid REFERENCES public.associados(id) ON DELETE SET NULL,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  placa text,
  nome_autorizador text NOT NULL,
  justificativa text NOT NULL,
  operador_user_id uuid,
  operador_nome text,
  ciente_por uuid,
  ciente_em timestamptz,
  observacao_supervisor text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotência: 1 registro por (contrato, tipo). Permite reenvio sem duplicar.
CREATE UNIQUE INDEX IF NOT EXISTS ux_aprovacoes_bypass_troca_contrato_tipo
  ON public.aprovacoes_bypass_troca(contrato_id, tipo)
  WHERE contrato_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aprovacoes_bypass_troca_status_created
  ON public.aprovacoes_bypass_troca(status, created_at DESC);

GRANT SELECT, UPDATE ON public.aprovacoes_bypass_troca TO authenticated;
GRANT ALL ON public.aprovacoes_bypass_troca TO service_role;

ALTER TABLE public.aprovacoes_bypass_troca ENABLE ROW LEVEL SECURITY;

-- Leitura: usuários internos autenticados (a visibilidade da PÁGINA é controlada por permissão no front).
CREATE POLICY "Autenticados leem aprovações de bypass de troca"
  ON public.aprovacoes_bypass_troca
  FOR SELECT
  TO authenticated
  USING (true);

-- Update: apenas para marcar ciência (qualquer autenticado pode marcar; UI restringe quem vê a página).
CREATE POLICY "Autenticados marcam ciência"
  ON public.aprovacoes_bypass_troca
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Inserts apenas via service_role (edges aprovar-troca-cadastro / converter-troca-em-cotacao-normal).

CREATE OR REPLACE FUNCTION public.tg_aprovacoes_bypass_troca_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aprovacoes_bypass_troca_updated_at ON public.aprovacoes_bypass_troca;
CREATE TRIGGER trg_aprovacoes_bypass_troca_updated_at
  BEFORE UPDATE ON public.aprovacoes_bypass_troca
  FOR EACH ROW EXECUTE FUNCTION public.tg_aprovacoes_bypass_troca_updated_at();
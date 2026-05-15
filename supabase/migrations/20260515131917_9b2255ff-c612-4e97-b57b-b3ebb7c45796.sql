-- Auditoria do gate de Situação Financeira SGA no Cadastro
CREATE TABLE IF NOT EXISTS public.sga_situacao_check (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  solicitacao_troca_id uuid NULL REFERENCES public.solicitacoes_troca_titularidade(id) ON DELETE CASCADE,
  associado_id uuid NULL REFERENCES public.associados(id) ON DELETE SET NULL,
  cpf text NOT NULL,
  codigo_hinova integer NULL,
  verificado_em timestamptz NOT NULL DEFAULT now(),
  verificado_por uuid NULL,
  tem_debito boolean NOT NULL,
  saldo_devedor numeric(12,2) NOT NULL DEFAULT 0,
  qtd_boletos_abertos integer NOT NULL DEFAULT 0,
  origem_resultado text NOT NULL DEFAULT 'sga' CHECK (origem_resultado IN ('sga','transitorio','associado_inexistente_sga','bypass','erro')),
  motivo text NULL,
  payload jsonb NULL,
  bypass boolean NOT NULL DEFAULT false,
  bypass_motivo text NULL,
  bypass_por uuid NULL,
  CHECK (contrato_id IS NOT NULL OR solicitacao_troca_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_sga_situacao_check_contrato ON public.sga_situacao_check(contrato_id, verificado_em DESC);
CREATE INDEX IF NOT EXISTS idx_sga_situacao_check_troca ON public.sga_situacao_check(solicitacao_troca_id, verificado_em DESC);
CREATE INDEX IF NOT EXISTS idx_sga_situacao_check_associado ON public.sga_situacao_check(associado_id, verificado_em DESC);

ALTER TABLE public.sga_situacao_check ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer funcionário interno autenticado (mesmo padrão do SGA)
CREATE POLICY "Internos podem ler sga_situacao_check"
ON public.sga_situacao_check FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text NOT IN ('associado')
  )
);

-- Insert/Update somente via service role (edge functions)
CREATE POLICY "Service role gerencia sga_situacao_check"
ON public.sga_situacao_check FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- Adiciona permissão de bypass ao Diretor (jsonb permissions array)
UPDATE public.app_roles_config
SET permissions = COALESCE(permissions, '[]'::jsonb) || '["cadastro.bypass_inadimplencia_sga"]'::jsonb
WHERE role = 'diretor'
  AND NOT (COALESCE(permissions,'[]'::jsonb) ? 'cadastro.bypass_inadimplencia_sga');
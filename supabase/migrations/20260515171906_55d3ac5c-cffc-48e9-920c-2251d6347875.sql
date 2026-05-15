
-- Auditoria de avisos SGA durante a cotação + decisões "Ignorar e Prosseguir"
DO $$ BEGIN
  CREATE TYPE public.aviso_sga_tipo AS ENUM (
    'placa_duplicada_outro_vendedor',
    'veiculo_existe_sga',
    'placa_outro_associado_local',
    'cpf_associado_veiculo_ativo',
    'cpf_ex_cliente_inadimplente',
    'inclusao_associado_com_debito',
    'cadastro_situacao_financeira_pendente'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.aviso_sga_decisao AS ENUM (
    'ignorado_prosseguiu',
    'cancelou',
    'visualizou'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.cotacao_avisos_sga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid REFERENCES public.cotacoes(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  associado_id uuid REFERENCES public.associados(id) ON DELETE SET NULL,
  cpf text,
  placa text,
  tipo public.aviso_sga_tipo NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  detalhes jsonb DEFAULT '{}'::jsonb,
  decisao public.aviso_sga_decisao NOT NULL,
  motivo text,
  decidido_por uuid,
  decidido_por_nome text,
  decidido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cotacao_avisos_sga_cotacao ON public.cotacao_avisos_sga(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_cotacao_avisos_sga_contrato ON public.cotacao_avisos_sga(contrato_id);
CREATE INDEX IF NOT EXISTS idx_cotacao_avisos_sga_cpf ON public.cotacao_avisos_sga(cpf);
CREATE INDEX IF NOT EXISTS idx_cotacao_avisos_sga_placa ON public.cotacao_avisos_sga(placa);
CREATE INDEX IF NOT EXISTS idx_cotacao_avisos_sga_associado ON public.cotacao_avisos_sga(associado_id);

ALTER TABLE public.cotacao_avisos_sga ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internos veem avisos sga" ON public.cotacao_avisos_sga;
CREATE POLICY "internos veem avisos sga"
  ON public.cotacao_avisos_sga
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "internos inserem avisos sga" ON public.cotacao_avisos_sga;
CREATE POLICY "internos inserem avisos sga"
  ON public.cotacao_avisos_sga
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Service role pode tudo (default já permite, política explícita para clareza)
DROP POLICY IF EXISTS "service role full access avisos sga" ON public.cotacao_avisos_sga;
CREATE POLICY "service role full access avisos sga"
  ON public.cotacao_avisos_sga
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

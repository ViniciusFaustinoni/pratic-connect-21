-- =============================================
-- MULTI-EMPRESA: Associação (Pratic) + LTDAs
-- Permite duas visões: consolidada (por setor) e real (por empresa)
-- =============================================

-- ---------------------------------------------
-- Empresas / entidades do grupo
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(150) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'ltda' CHECK (tipo IN ('associacao', 'ltda')),
  papel VARCHAR(30) NOT NULL DEFAULT 'outros' CHECK (papel IN (
    'associacao', 'oficina', 'gestao', 'marketing_vendas',
    'monitoramento', 'assistencia', 'outros'
  )),
  cnpj VARCHAR(18),
  percentual_rateio DECIMAL(5,2) NOT NULL DEFAULT 0,
  cor VARCHAR(20) NOT NULL DEFAULT 'slate',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed das empresas do grupo (editáveis depois na tela)
INSERT INTO public.empresas (nome, tipo, papel, cor, ordem) VALUES
  ('Pratic (Associação)', 'associacao', 'associacao', 'violet', 1),
  ('LAD', 'ltda', 'oficina', 'blue', 10),
  ('DKAP', 'ltda', 'gestao', 'emerald', 20),
  ('Fernandes Design', 'ltda', 'marketing_vendas', 'amber', 30),
  ('Monitoramento', 'ltda', 'monitoramento', 'cyan', 40),
  ('Assistência 24h', 'ltda', 'assistencia', 'rose', 50)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------
-- De/Para: setor (visão consolidada) -> empresa (visão real)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.setor_empresa_map (
  setor VARCHAR(50) PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mapeamento padrão setor -> empresa
INSERT INTO public.setor_empresa_map (setor, empresa_id) VALUES
  ('comercial',      (SELECT id FROM public.empresas WHERE papel='marketing_vendas' LIMIT 1)),
  ('marketing',      (SELECT id FROM public.empresas WHERE papel='marketing_vendas' LIMIT 1)),
  ('oficinas',       (SELECT id FROM public.empresas WHERE papel='oficina' LIMIT 1)),
  ('monitoramento',  (SELECT id FROM public.empresas WHERE papel='monitoramento' LIMIT 1)),
  ('assistencia',    (SELECT id FROM public.empresas WHERE papel='assistencia' LIMIT 1)),
  ('gestao',         (SELECT id FROM public.empresas WHERE papel='gestao' LIMIT 1)),
  ('financeiro',     (SELECT id FROM public.empresas WHERE papel='gestao' LIMIT 1)),
  ('contabilidade',  (SELECT id FROM public.empresas WHERE papel='gestao' LIMIT 1)),
  ('rh',             (SELECT id FROM public.empresas WHERE papel='gestao' LIMIT 1)),
  ('juridico',       (SELECT id FROM public.empresas WHERE papel='gestao' LIMIT 1)),
  ('cadastro',       (SELECT id FROM public.empresas WHERE papel='gestao' LIMIT 1)),
  ('relacionamento', (SELECT id FROM public.empresas WHERE papel='gestao' LIMIT 1)),
  ('eventos',        (SELECT id FROM public.empresas WHERE papel='gestao' LIMIT 1)),
  ('ti',             (SELECT id FROM public.empresas WHERE papel='gestao' LIMIT 1)),
  ('diretoria',      (SELECT id FROM public.empresas WHERE papel='associacao' LIMIT 1)),
  ('outros',         (SELECT id FROM public.empresas WHERE papel='gestao' LIMIT 1))
ON CONFLICT (setor) DO NOTHING;

-- ---------------------------------------------
-- Vínculo de empresa nas tabelas financeiras
-- ---------------------------------------------
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.solicitacoes_financeiras
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.contas_bancarias
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa ON public.contas_pagar(empresa_id);
CREATE INDEX IF NOT EXISTS idx_solic_fin_empresa ON public.solicitacoes_financeiras(empresa_id);

-- ---------------------------------------------
-- Trigger: define empresa da solicitação pelo setor (quando não informada)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.set_empresa_solicitacao_por_setor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS NULL AND NEW.setor IS NOT NULL THEN
    SELECT empresa_id INTO NEW.empresa_id
    FROM public.setor_empresa_map
    WHERE setor = NEW.setor;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_empresa_solicitacao ON public.solicitacoes_financeiras;
CREATE TRIGGER trg_set_empresa_solicitacao
BEFORE INSERT ON public.solicitacoes_financeiras
FOR EACH ROW EXECUTE FUNCTION public.set_empresa_solicitacao_por_setor();

-- ---------------------------------------------
-- RLS
-- ---------------------------------------------
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setor_empresa_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ler empresas" ON public.empresas;
CREATE POLICY "ler empresas" ON public.empresas
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "gerir empresas" ON public.empresas;
CREATE POLICY "gerir empresas" ON public.empresas
FOR ALL TO authenticated
USING (public.is_funcionario(auth.uid()) OR public.is_socio(auth.uid()))
WITH CHECK (public.is_funcionario(auth.uid()) OR public.is_socio(auth.uid()));

DROP POLICY IF EXISTS "ler setor_empresa_map" ON public.setor_empresa_map;
CREATE POLICY "ler setor_empresa_map" ON public.setor_empresa_map
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "gerir setor_empresa_map" ON public.setor_empresa_map;
CREATE POLICY "gerir setor_empresa_map" ON public.setor_empresa_map
FOR ALL TO authenticated
USING (public.is_funcionario(auth.uid()) OR public.is_socio(auth.uid()))
WITH CHECK (public.is_funcionario(auth.uid()) OR public.is_socio(auth.uid()));

-- =============================================
-- MÓDULO: SOLICITAÇÕES E LIBERAÇÕES FINANCEIRAS
-- Fluxo: solicitante (colaborador/prestador) cria ->
--        3 sócios liberam (todos precisam aprovar) ->
--        financeiro paga (vira Conta a Pagar automaticamente)
-- =============================================

-- ---------------------------------------------
-- ROLE "socio" no catálogo dinâmico de roles
-- ---------------------------------------------
INSERT INTO public.app_roles_config (role, label, description, area, sigla, color, icon_name, sort_order, is_active)
VALUES (
  'socio',
  'Sócio',
  'Sócio da empresa. Libera (aprova) as solicitações financeiras antes do pagamento.',
  'Diretoria',
  'Soc',
  'amber',
  'Crown',
  3,
  true
)
ON CONFLICT (role) DO NOTHING;

-- ---------------------------------------------
-- FUNÇÕES AUXILIARES
-- ---------------------------------------------

-- É sócio ativo?
CREATE OR REPLACE FUNCTION public.is_socio(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'socio'
      AND p.ativo = true
      AND (p.bloqueado IS NULL OR p.bloqueado = false)
  )
$$;

-- Quantos sócios ativos existem (referência informativa)
CREATE OR REPLACE FUNCTION public.count_socios_ativos()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT ur.user_id)::int
  FROM public.user_roles ur
  INNER JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'socio'
    AND p.ativo = true
    AND (p.bloqueado IS NULL OR p.bloqueado = false)
$$;

-- ---------------------------------------------
-- TABELA PRINCIPAL: solicitacoes_financeiras
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitacoes_financeiras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tipo de solicitação
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('pagamento', 'reembolso')),

    -- Mesma taxonomia de Contas a Pagar (para integração)
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN (
        'prestador_assistencia', 'oficina', 'fornecedor',
        'folha_pagamento', 'impostos', 'aluguel',
        'servicos', 'marketing', 'outros'
    )),
    subcategoria VARCHAR(100),

    descricao TEXT NOT NULL,
    valor DECIMAL(12,2) NOT NULL CHECK (valor > 0),

    -- Quem pediu (colaborador / prestador)
    solicitante_id UUID REFERENCES public.profiles(id),
    solicitante_nome VARCHAR(255) NOT NULL,

    -- Favorecido do pagamento (pode ser o próprio solicitante)
    favorecido_nome VARCHAR(255),
    favorecido_documento VARCHAR(18),

    -- Dados de pagamento
    forma_pagamento VARCHAR(30),
    banco VARCHAR(100),
    agencia VARCHAR(20),
    conta VARCHAR(30),
    pix_chave VARCHAR(255),

    data_necessidade DATE,

    -- Comprovante OBRIGATÓRIO (nota fiscal / recibo / foto)
    comprovante_url VARCHAR(500) NOT NULL,
    anexos_extras JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Workflow
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN (
        'pendente', 'aprovado', 'rejeitado', 'pago', 'cancelado'
    )),
    aprovacoes_necessarias INTEGER NOT NULL DEFAULT 3,
    aprovacoes_count INTEGER NOT NULL DEFAULT 0,

    rejeitado_por UUID REFERENCES public.profiles(id),
    rejeitado_em TIMESTAMPTZ,
    motivo_rejeicao TEXT,

    -- Pagamento (financeiro)
    pago_por UUID REFERENCES public.profiles(id),
    pago_em TIMESTAMPTZ,
    conta_pagar_id UUID REFERENCES public.contas_pagar(id) ON DELETE SET NULL,

    observacao TEXT,

    criado_por UUID REFERENCES public.profiles(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------
-- TABELA DE APROVAÇÕES (1 linha por sócio)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitacoes_financeiras_aprovacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitacao_id UUID NOT NULL REFERENCES public.solicitacoes_financeiras(id) ON DELETE CASCADE,
    socio_id UUID NOT NULL REFERENCES public.profiles(id),
    socio_nome VARCHAR(255),
    decisao VARCHAR(20) NOT NULL CHECK (decisao IN ('aprovado', 'rejeitado')),
    comentario TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (solicitacao_id, socio_id)
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_solic_fin_status ON public.solicitacoes_financeiras(status);
CREATE INDEX IF NOT EXISTS idx_solic_fin_solicitante ON public.solicitacoes_financeiras(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_solic_fin_criado_por ON public.solicitacoes_financeiras(criado_por);
CREATE INDEX IF NOT EXISTS idx_solic_fin_created ON public.solicitacoes_financeiras(created_at);
CREATE INDEX IF NOT EXISTS idx_solic_fin_aprov_solic ON public.solicitacoes_financeiras_aprovacoes(solicitacao_id);

-- ---------------------------------------------
-- TRIGGER: recalcula status com base nas aprovações
-- (3 sócios precisam aprovar; qualquer rejeição reprova)
-- SECURITY DEFINER para atualizar a solicitação mesmo via RLS do sócio.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.recalcular_status_solicitacao_financeira()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitacao_id uuid;
  v_aprovacoes int;
  v_rejeicoes int;
  v_necessarias int;
  v_status text;
  v_rej record;
BEGIN
  v_solicitacao_id := COALESCE(NEW.solicitacao_id, OLD.solicitacao_id);

  SELECT status, aprovacoes_necessarias
    INTO v_status, v_necessarias
    FROM public.solicitacoes_financeiras
   WHERE id = v_solicitacao_id;

  -- Não altera solicitações já finalizadas (pagas/canceladas)
  IF v_status IN ('pago', 'cancelado') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE decisao = 'aprovado'),
    COUNT(*) FILTER (WHERE decisao = 'rejeitado')
    INTO v_aprovacoes, v_rejeicoes
    FROM public.solicitacoes_financeiras_aprovacoes
   WHERE solicitacao_id = v_solicitacao_id;

  IF v_rejeicoes > 0 THEN
    SELECT socio_id, comentario, created_at
      INTO v_rej
      FROM public.solicitacoes_financeiras_aprovacoes
     WHERE solicitacao_id = v_solicitacao_id AND decisao = 'rejeitado'
     ORDER BY created_at DESC
     LIMIT 1;

    UPDATE public.solicitacoes_financeiras
       SET status = 'rejeitado',
           aprovacoes_count = v_aprovacoes,
           rejeitado_por = v_rej.socio_id,
           rejeitado_em = v_rej.created_at,
           motivo_rejeicao = v_rej.comentario,
           updated_at = NOW()
     WHERE id = v_solicitacao_id;

  ELSIF v_aprovacoes >= v_necessarias THEN
    UPDATE public.solicitacoes_financeiras
       SET status = 'aprovado',
           aprovacoes_count = v_aprovacoes,
           rejeitado_por = NULL,
           rejeitado_em = NULL,
           motivo_rejeicao = NULL,
           updated_at = NOW()
     WHERE id = v_solicitacao_id;

  ELSE
    UPDATE public.solicitacoes_financeiras
       SET status = 'pendente',
           aprovacoes_count = v_aprovacoes,
           rejeitado_por = NULL,
           rejeitado_em = NULL,
           motivo_rejeicao = NULL,
           updated_at = NOW()
     WHERE id = v_solicitacao_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_status_solic_fin ON public.solicitacoes_financeiras_aprovacoes;
CREATE TRIGGER trg_recalcular_status_solic_fin
AFTER INSERT OR UPDATE OR DELETE ON public.solicitacoes_financeiras_aprovacoes
FOR EACH ROW EXECUTE FUNCTION public.recalcular_status_solicitacao_financeira();

-- ---------------------------------------------
-- RLS
-- ---------------------------------------------
ALTER TABLE public.solicitacoes_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_financeiras_aprovacoes ENABLE ROW LEVEL SECURITY;

-- SELECT: financeiro/sócio veem tudo; demais veem as próprias
DROP POLICY IF EXISTS "ler solicitacoes financeiras" ON public.solicitacoes_financeiras;
CREATE POLICY "ler solicitacoes financeiras" ON public.solicitacoes_financeiras
FOR SELECT TO authenticated
USING (
  public.is_funcionario(auth.uid())
  OR public.is_socio(auth.uid())
  OR criado_por = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR solicitante_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- INSERT: qualquer usuário autenticado cria sua própria solicitação
DROP POLICY IF EXISTS "criar solicitacao financeira" ON public.solicitacoes_financeiras;
CREATE POLICY "criar solicitacao financeira" ON public.solicitacoes_financeiras
FOR INSERT TO authenticated
WITH CHECK (
  criado_por = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- UPDATE: financeiro gerencia (pagar/cancelar/editar); solicitante pode cancelar a própria enquanto pendente
DROP POLICY IF EXISTS "atualizar solicitacao financeira" ON public.solicitacoes_financeiras;
CREATE POLICY "atualizar solicitacao financeira" ON public.solicitacoes_financeiras
FOR UPDATE TO authenticated
USING (
  public.is_funcionario(auth.uid())
  OR (
    status = 'pendente'
    AND criado_por = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- DELETE: somente financeiro
DROP POLICY IF EXISTS "excluir solicitacao financeira" ON public.solicitacoes_financeiras;
CREATE POLICY "excluir solicitacao financeira" ON public.solicitacoes_financeiras
FOR DELETE TO authenticated
USING (public.is_funcionario(auth.uid()));

-- Aprovações --------------------------------------------------

-- SELECT: financeiro/sócio veem tudo; dono da solicitação vê as da própria
DROP POLICY IF EXISTS "ler aprovacoes solic fin" ON public.solicitacoes_financeiras_aprovacoes;
CREATE POLICY "ler aprovacoes solic fin" ON public.solicitacoes_financeiras_aprovacoes
FOR SELECT TO authenticated
USING (
  public.is_funcionario(auth.uid())
  OR public.is_socio(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.solicitacoes_financeiras s
    WHERE s.id = solicitacao_id
      AND (
        s.criado_por = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        OR s.solicitante_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
  )
);

-- INSERT: somente sócios, registrando o próprio voto
DROP POLICY IF EXISTS "criar aprovacao solic fin" ON public.solicitacoes_financeiras_aprovacoes;
CREATE POLICY "criar aprovacao solic fin" ON public.solicitacoes_financeiras_aprovacoes
FOR INSERT TO authenticated
WITH CHECK (
  public.is_socio(auth.uid())
  AND socio_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- UPDATE: sócio pode alterar o próprio voto
DROP POLICY IF EXISTS "atualizar aprovacao solic fin" ON public.solicitacoes_financeiras_aprovacoes;
CREATE POLICY "atualizar aprovacao solic fin" ON public.solicitacoes_financeiras_aprovacoes
FOR UPDATE TO authenticated
USING (
  public.is_socio(auth.uid())
  AND socio_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- DELETE: sócio pode remover o próprio voto
DROP POLICY IF EXISTS "excluir aprovacao solic fin" ON public.solicitacoes_financeiras_aprovacoes;
CREATE POLICY "excluir aprovacao solic fin" ON public.solicitacoes_financeiras_aprovacoes
FOR DELETE TO authenticated
USING (
  public.is_socio(auth.uid())
  AND socio_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- ---------------------------------------------
-- STORAGE: bucket de comprovantes
-- ---------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('solicitacoes-financeiras', 'solicitacoes-financeiras', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "upload comprovantes solic fin" ON storage.objects;
CREATE POLICY "upload comprovantes solic fin" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'solicitacoes-financeiras');

DROP POLICY IF EXISTS "ler comprovantes solic fin" ON storage.objects;
CREATE POLICY "ler comprovantes solic fin" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'solicitacoes-financeiras');

CREATE TABLE IF NOT EXISTS public.grade_comissao_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id uuid NOT NULL REFERENCES public.grades_comissao(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grade_id, plano_id)
);

CREATE TABLE IF NOT EXISTS public.grade_comissao_plano_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id uuid NOT NULL REFERENCES public.grades_comissao(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  parcela_id uuid NULL,
  parcela_numero integer NULL,
  vitalicia boolean NOT NULL DEFAULT false,
  vitalicia_inicio_parcela integer NULL,
  role text NOT NULL,
  nome_nivel text NULL,
  tipo_comissao text NOT NULL DEFAULT 'percentual',
  valor numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grade_comissao_plano_regras_tipo_check CHECK (tipo_comissao IN ('percentual', 'valor_fixo')),
  CONSTRAINT grade_comissao_plano_regras_valor_check CHECK (valor >= 0),
  CONSTRAINT grade_comissao_plano_regras_parcela_check CHECK (parcela_numero IS NULL OR parcela_numero > 0),
  CONSTRAINT grade_comissao_plano_regras_vitalicia_inicio_check CHECK (vitalicia_inicio_parcela IS NULL OR vitalicia_inicio_parcela > 0)
);

ALTER TABLE public.grade_comissao_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_comissao_plano_regras ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_grade_comissao_planos_grade ON public.grade_comissao_planos(grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_comissao_planos_plano ON public.grade_comissao_planos(plano_id);
CREATE INDEX IF NOT EXISTS idx_grade_comissao_plano_regras_lookup ON public.grade_comissao_plano_regras(grade_id, plano_id, parcela_numero, role) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_grade_comissao_plano_regras_vitalicia ON public.grade_comissao_plano_regras(grade_id, plano_id, vitalicia_inicio_parcela) WHERE ativo = true AND vitalicia = true;

CREATE OR REPLACE FUNCTION public.is_comissao_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'gerente_comercial')
    OR public.has_role(auth.uid(), 'supervisor_vendas');
$$;

DROP POLICY IF EXISTS "Comissoes manager can read grade plans" ON public.grade_comissao_planos;
DROP POLICY IF EXISTS "Comissoes manager can manage grade plans" ON public.grade_comissao_planos;
DROP POLICY IF EXISTS "Comissoes manager can read plan rules" ON public.grade_comissao_plano_regras;
DROP POLICY IF EXISTS "Comissoes manager can manage plan rules" ON public.grade_comissao_plano_regras;

CREATE POLICY "Comissoes manager can read grade plans"
ON public.grade_comissao_planos
FOR SELECT
TO authenticated
USING (public.is_comissao_manager());

CREATE POLICY "Comissoes manager can manage grade plans"
ON public.grade_comissao_planos
FOR ALL
TO authenticated
USING (public.is_comissao_manager())
WITH CHECK (public.is_comissao_manager());

CREATE POLICY "Comissoes manager can read plan rules"
ON public.grade_comissao_plano_regras
FOR SELECT
TO authenticated
USING (public.is_comissao_manager());

CREATE POLICY "Comissoes manager can manage plan rules"
ON public.grade_comissao_plano_regras
FOR ALL
TO authenticated
USING (public.is_comissao_manager())
WITH CHECK (public.is_comissao_manager());

DROP TRIGGER IF EXISTS trg_grade_comissao_planos_updated_at ON public.grade_comissao_planos;
CREATE TRIGGER trg_grade_comissao_planos_updated_at
BEFORE UPDATE ON public.grade_comissao_planos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_grade_comissao_plano_regras_updated_at ON public.grade_comissao_plano_regras;
CREATE TRIGGER trg_grade_comissao_plano_regras_updated_at
BEFORE UPDATE ON public.grade_comissao_plano_regras
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS grade_id uuid NULL REFERENCES public.grades_comissao(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role_destinatario text NULL,
  ADD COLUMN IF NOT EXISTS tipo_calculo text NULL,
  ADD COLUMN IF NOT EXISTS plano_regra_id uuid NULL REFERENCES public.grade_comissao_plano_regras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comissoes_relatorio_periodo ON public.comissoes(ano_referencia, mes_referencia, status);
CREATE INDEX IF NOT EXISTS idx_comissoes_relatorio_grade ON public.comissoes(grade_id, plano_id, parcela_numero, role_destinatario);

CREATE OR REPLACE FUNCTION public.fn_gerar_comissoes_por_pagamento(p_cobranca_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cobranca record;
  v_contrato record;
  v_vendedor_id uuid;
  v_plano_id uuid;
  v_data_venda timestamptz;
  v_grade_id uuid;
  v_grade_versao_id uuid;
  v_snapshot jsonb;
  v_numero_parcela integer;
  v_cadeia record;
  v_regra record;
  v_destinatario_id uuid;
  v_valor_base numeric;
  v_valor_comissao numeric;
  v_percentual numeric;
  v_inseridos integer := 0;
BEGIN
  SELECT * INTO v_cobranca FROM public.cobrancas WHERE id = p_cobranca_id;
  IF NOT FOUND OR v_cobranca.contrato_id IS NULL THEN
    RETURN 0;
  END IF;

  IF v_cobranca.status NOT IN ('pago','paid','recebido','confirmado') AND v_cobranca.data_pagamento IS NULL THEN
    RETURN 0;
  END IF;

  v_valor_base := COALESCE(v_cobranca.valor_pago, v_cobranca.valor_final, v_cobranca.valor, 0);
  IF v_valor_base <= 0 THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_contrato FROM public.contratos WHERE id = v_cobranca.contrato_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_vendedor_id := v_contrato.vendedor_id;
  v_plano_id := v_contrato.plano_id;
  v_data_venda := COALESCE(v_contrato.data_assinatura, v_contrato.data_inicio, v_contrato.created_at, v_cobranca.data_pagamento, now());

  IF v_vendedor_id IS NULL OR v_plano_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT grade_id, versao_id, snapshot
    INTO v_grade_id, v_grade_versao_id, v_snapshot
  FROM public.fn_resolver_grade_vendedor_em(v_vendedor_id, v_data_venda)
  LIMIT 1;

  IF v_grade_id IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.grade_comissao_planos gcp
    WHERE gcp.grade_id = v_grade_id
      AND gcp.plano_id = v_plano_id
      AND gcp.ativo = true
  ) THEN
    RETURN 0;
  END IF;

  v_numero_parcela := public.fn_determinar_numero_parcela_cobranca(p_cobranca_id);
  SELECT * INTO v_cadeia FROM public.fn_resolver_cadeia(v_vendedor_id, v_data_venda) LIMIT 1;

  FOR v_regra IN
    WITH candidatas AS (
      SELECT r.*,
             CASE
               WHEN r.vitalicia = false AND r.parcela_numero = v_numero_parcela THEN 1
               WHEN r.vitalicia = true AND v_numero_parcela >= COALESCE(r.vitalicia_inicio_parcela, r.parcela_numero, 2) THEN 2
               ELSE 9
             END AS prioridade
      FROM public.grade_comissao_plano_regras r
      WHERE r.grade_id = v_grade_id
        AND r.plano_id = v_plano_id
        AND r.ativo = true
        AND (
          (r.vitalicia = false AND r.parcela_numero = v_numero_parcela)
          OR (r.vitalicia = true AND v_numero_parcela >= COALESCE(r.vitalicia_inicio_parcela, r.parcela_numero, 2))
        )
    )
    SELECT DISTINCT ON (role) *
    FROM candidatas
    ORDER BY role, prioridade, ordem, created_at
  LOOP
    IF v_regra.valor <= 0 THEN
      CONTINUE;
    END IF;

    v_destinatario_id := CASE v_regra.role
      WHEN 'vendedor_clt' THEN v_vendedor_id
      WHEN 'vendedor_externo' THEN v_vendedor_id
      WHEN 'supervisor_vendas' THEN v_cadeia.supervisor_id
      WHEN 'gerente_comercial' THEN v_cadeia.gerente_id
      WHEN 'agencia' THEN v_cadeia.agencia_id
      ELSE NULL
    END;

    IF v_destinatario_id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_regra.tipo_comissao = 'valor_fixo' THEN
      v_valor_comissao := ROUND(v_regra.valor, 2);
      v_percentual := 0;
    ELSE
      v_percentual := v_regra.valor;
      v_valor_comissao := ROUND(v_valor_base * v_regra.valor / 100.0, 2);
    END IF;

    INSERT INTO public.comissoes (
      vendedor_id,
      contrato_id,
      associado_id,
      cobranca_id,
      grade_id,
      grade_versao_id,
      plano_id,
      plano_regra_id,
      role_destinatario,
      tipo_calculo,
      tipo_comissao,
      nivel_nome,
      parcela_numero,
      valor_base,
      percentual_aplicado,
      valor_comissao,
      valor_total,
      status,
      mes_referencia,
      ano_referencia,
      observacoes
    ) VALUES (
      v_destinatario_id,
      v_contrato.id,
      v_cobranca.associado_id,
      p_cobranca_id,
      v_grade_id,
      v_grade_versao_id,
      v_plano_id,
      v_regra.id,
      v_regra.role,
      v_regra.tipo_comissao,
      CASE WHEN v_numero_parcela = 1 THEN 'adesao' ELSE 'recorrente' END,
      COALESCE(v_regra.nome_nivel, v_regra.role),
      v_numero_parcela,
      v_valor_base,
      v_percentual,
      v_valor_comissao,
      v_valor_comissao,
      'pendente',
      EXTRACT(MONTH FROM COALESCE(v_cobranca.data_pagamento, CURRENT_DATE))::integer,
      EXTRACT(YEAR FROM COALESCE(v_cobranca.data_pagamento, CURRENT_DATE))::integer,
      'Gerada automaticamente por pagamento: grade/plano/perfil (parcela ' || v_numero_parcela || ')'
    )
    ON CONFLICT (cobranca_id, vendedor_id, nivel_nome) WHERE cobranca_id IS NOT NULL
    DO NOTHING;

    IF FOUND THEN
      v_inseridos := v_inseridos + 1;
    END IF;
  END LOOP;

  RETURN v_inseridos;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_comissao_manager() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_gerar_comissoes_por_pagamento(uuid) TO authenticated, service_role;
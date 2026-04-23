
-- ===========================================
-- FASE 3: MOTOR DE CÁLCULO DE COMISSÕES
-- ===========================================

-- 1) Índice único para idempotência
CREATE UNIQUE INDEX IF NOT EXISTS ux_comissoes_cobranca_vendedor_nivel
  ON public.comissoes (cobranca_id, vendedor_id, nivel_nome)
  WHERE cobranca_id IS NOT NULL;

-- Índice de apoio para resolver "número da parcela" rapidamente
CREATE INDEX IF NOT EXISTS ix_cobrancas_contrato_venc
  ON public.cobrancas (contrato_id, data_vencimento)
  WHERE contrato_id IS NOT NULL;

-- 2) FUNÇÃO: resolver grade vigente para um vendedor numa data de referência
CREATE OR REPLACE FUNCTION public.fn_resolver_grade_vendedor_em(
  p_vendedor_id uuid,
  p_data_referencia timestamptz
)
RETURNS TABLE (
  grade_id uuid,
  versao_id uuid,
  snapshot jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grade_id uuid;
BEGIN
  -- Pega a grade ativa do vendedor naquela data (ou mais antiga válida se nenhuma cobrir a data)
  SELECT ugc.grade_id
    INTO v_grade_id
  FROM public.usuario_grade_comissao ugc
  WHERE ugc.usuario_id = p_vendedor_id
    AND COALESCE(ugc.ativo, true) = true
    AND (ugc.data_inicio IS NULL OR ugc.data_inicio <= p_data_referencia)
    AND (ugc.data_fim IS NULL OR ugc.data_fim > p_data_referencia)
  ORDER BY ugc.data_inicio DESC NULLS LAST
  LIMIT 1;

  IF v_grade_id IS NULL THEN
    RETURN;
  END IF;

  -- Versão da grade vigente naquela data; fallback para a mais antiga se nada for anterior
  RETURN QUERY
  SELECT v.grade_id, v.id AS versao_id, v.snapshot
  FROM public.grades_comissao_versoes v
  WHERE v.grade_id = v_grade_id
    AND v.vigente_desde <= p_data_referencia
  ORDER BY v.vigente_desde DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT v.grade_id, v.id, v.snapshot
    FROM public.grades_comissao_versoes v
    WHERE v.grade_id = v_grade_id
    ORDER BY v.vigente_desde ASC
    LIMIT 1;
  END IF;
END;
$$;

-- 3) FUNÇÃO: determinar o número da parcela de uma cobrança dentro do contrato
CREATE OR REPLACE FUNCTION public.fn_determinar_numero_parcela_cobranca(
  p_cobranca_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato_id uuid;
  v_tipo text;
  v_data_venc date;
  v_numero integer;
BEGIN
  SELECT contrato_id, tipo, data_vencimento
    INTO v_contrato_id, v_tipo, v_data_venc
  FROM public.cobrancas
  WHERE id = p_cobranca_id;

  IF v_contrato_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Adesão sempre é parcela 1
  IF v_tipo IN ('adesao', 'taxa_adesao', 'filiacao') THEN
    RETURN 1;
  END IF;

  -- Caso geral: rank por data de vencimento dentro do contrato (adesão = 1, demais a partir de 2)
  SELECT rnk
    INTO v_numero
  FROM (
    SELECT id,
           CASE WHEN tipo IN ('adesao','taxa_adesao','filiacao') THEN 1
                ELSE 1 + ROW_NUMBER() OVER (
                  PARTITION BY (tipo IN ('adesao','taxa_adesao','filiacao'))
                  ORDER BY data_vencimento, created_at
                )
           END AS rnk
    FROM public.cobrancas
    WHERE contrato_id = v_contrato_id
  ) ranked
  WHERE id = p_cobranca_id;

  RETURN COALESCE(v_numero, 1);
END;
$$;

-- 4) FUNÇÃO PRINCIPAL: gerar comissões para uma cobrança paga
CREATE OR REPLACE FUNCTION public.fn_gerar_comissoes_por_pagamento(
  p_cobranca_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cobranca record;
  v_contrato record;
  v_vendedor_id uuid;
  v_data_venda timestamptz;
  v_grade_versao_id uuid;
  v_snapshot jsonb;
  v_numero_parcela integer;
  v_parcela jsonb;
  v_parcela_match jsonb;
  v_vitalicia_match jsonb;
  v_vitalicia_inicio integer;
  v_nivel jsonb;
  v_role text;
  v_percentual numeric;
  v_nivel_nome text;
  v_destinatario_id uuid;
  v_cadeia record;
  v_valor_base numeric;
  v_valor_comissao numeric;
  v_inseridos integer := 0;
BEGIN
  -- Carrega cobrança
  SELECT * INTO v_cobranca FROM public.cobrancas WHERE id = p_cobranca_id;
  IF NOT FOUND OR v_cobranca.contrato_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Só processa cobranças pagas
  IF v_cobranca.status NOT IN ('pago','paid','recebido','confirmado') AND v_cobranca.data_pagamento IS NULL THEN
    RETURN 0;
  END IF;

  v_valor_base := COALESCE(v_cobranca.valor_pago, v_cobranca.valor_final, v_cobranca.valor, 0);
  IF v_valor_base <= 0 THEN
    RETURN 0;
  END IF;

  -- Carrega contrato
  SELECT * INTO v_contrato FROM public.contratos WHERE id = v_cobranca.contrato_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_vendedor_id := v_contrato.vendedor_id;
  v_data_venda := COALESCE(v_contrato.data_assinatura, v_contrato.data_inicio, v_contrato.created_at);

  IF v_vendedor_id IS NULL OR v_data_venda IS NULL THEN
    RETURN 0;
  END IF;

  -- Resolve grade vigente no momento da venda
  SELECT versao_id, snapshot
    INTO v_grade_versao_id, v_snapshot
  FROM public.fn_resolver_grade_vendedor_em(v_vendedor_id, v_data_venda)
  LIMIT 1;

  IF v_grade_versao_id IS NULL OR v_snapshot IS NULL THEN
    RETURN 0;
  END IF;

  -- Determina número da parcela
  v_numero_parcela := public.fn_determinar_numero_parcela_cobranca(p_cobranca_id);

  -- Procura parcela específica
  v_parcela_match := NULL;
  v_vitalicia_match := NULL;

  FOR v_parcela IN SELECT * FROM jsonb_array_elements(COALESCE(v_snapshot->'parcelas', '[]'::jsonb))
  LOOP
    IF COALESCE((v_parcela->'parcela'->>'vitalicia')::boolean, false) THEN
      v_vitalicia_match := v_parcela;
      v_vitalicia_inicio := COALESCE(
        (v_parcela->'parcela'->>'vitalicia_inicio_parcela')::integer,
        (v_parcela->'parcela'->>'numero_parcela')::integer,
        2
      );
    ELSIF (v_parcela->'parcela'->>'numero_parcela')::integer = v_numero_parcela THEN
      v_parcela_match := v_parcela;
    END IF;
  END LOOP;

  -- Fallback para vitalícia
  IF v_parcela_match IS NULL AND v_vitalicia_match IS NOT NULL
     AND v_numero_parcela >= v_vitalicia_inicio THEN
    v_parcela_match := v_vitalicia_match;
  END IF;

  IF v_parcela_match IS NULL THEN
    RETURN 0;
  END IF;

  -- Resolve cadeia hierárquica vigente na data da venda
  SELECT * INTO v_cadeia FROM public.fn_resolver_cadeia(v_vendedor_id, v_data_venda) LIMIT 1;

  -- Itera níveis e gera linhas
  FOR v_nivel IN SELECT * FROM jsonb_array_elements(COALESCE(v_parcela_match->'niveis', '[]'::jsonb))
  LOOP
    v_role := v_nivel->>'role';
    v_percentual := COALESCE((v_nivel->>'percentual')::numeric, 0);
    v_nivel_nome := COALESCE(v_nivel->>'nome', v_role);

    IF v_percentual <= 0 THEN
      CONTINUE;
    END IF;

    -- Mapeia role -> usuário destinatário
    v_destinatario_id := CASE v_role
      WHEN 'vendedor_clt' THEN v_vendedor_id
      WHEN 'vendedor_externo' THEN v_vendedor_id
      WHEN 'supervisor_vendas' THEN v_cadeia.supervisor_id
      WHEN 'gerente_comercial' THEN v_cadeia.gerente_id
      WHEN 'agencia' THEN v_cadeia.agencia_id
      ELSE v_vendedor_id
    END;

    IF v_destinatario_id IS NULL THEN
      CONTINUE;
    END IF;

    v_valor_comissao := ROUND(v_valor_base * v_percentual / 100.0, 2);

    INSERT INTO public.comissoes (
      vendedor_id,
      contrato_id,
      associado_id,
      cobranca_id,
      grade_versao_id,
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
      v_grade_versao_id,
      CASE WHEN v_numero_parcela = 1 THEN 'adesao' ELSE 'mensalidade' END,
      v_nivel_nome,
      v_numero_parcela,
      v_valor_base,
      v_percentual,
      v_valor_comissao,
      v_valor_comissao,
      'pendente',
      EXTRACT(MONTH FROM COALESCE(v_cobranca.data_pagamento, CURRENT_DATE))::integer,
      EXTRACT(YEAR  FROM COALESCE(v_cobranca.data_pagamento, CURRENT_DATE))::integer,
      'Gerada automaticamente por pagamento (parcela ' || v_numero_parcela || ')'
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

-- 5) TRIGGER: dispara geração quando cobrança vira paga
CREATE OR REPLACE FUNCTION public.trg_comissoes_em_pagamento_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_paid boolean;
  v_is_paid boolean;
BEGIN
  v_is_paid := (NEW.status IN ('pago','paid','recebido','confirmado')) OR NEW.data_pagamento IS NOT NULL;

  IF TG_OP = 'INSERT' THEN
    v_was_paid := false;
  ELSE
    v_was_paid := (OLD.status IN ('pago','paid','recebido','confirmado')) OR OLD.data_pagamento IS NOT NULL;
  END IF;

  IF v_is_paid AND NOT v_was_paid THEN
    BEGIN
      PERFORM public.fn_gerar_comissoes_por_pagamento(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falha ao gerar comissões para cobrança %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comissoes_em_pagamento ON public.cobrancas;
CREATE TRIGGER trg_comissoes_em_pagamento
  AFTER INSERT OR UPDATE OF status, data_pagamento, valor_pago ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_comissoes_em_pagamento_fn();

-- Permissões
GRANT EXECUTE ON FUNCTION public.fn_resolver_grade_vendedor_em(uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_determinar_numero_parcela_cobranca(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_gerar_comissoes_por_pagamento(uuid) TO authenticated, service_role;

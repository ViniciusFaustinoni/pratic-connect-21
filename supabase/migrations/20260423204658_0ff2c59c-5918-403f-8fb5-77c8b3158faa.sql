CREATE OR REPLACE FUNCTION public.fn_gerar_comissoes_por_pagamento(p_cobranca_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      observacoes,
      calculo_snapshot
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
      'Gerada automaticamente por pagamento: grade/plano/perfil (parcela ' || v_numero_parcela || ')',
      jsonb_build_object(
        'grade', jsonb_build_object(
          'id', v_grade_id,
          'nome', (SELECT g.nome FROM public.grades_comissao g WHERE g.id = v_grade_id),
          'versao_id', v_grade_versao_id,
          'versao', (SELECT gv.versao FROM public.grades_comissao_versoes gv WHERE gv.id = v_grade_versao_id)
        ),
        'plano', jsonb_build_object(
          'id', v_plano_id,
          'nome', (SELECT p.nome FROM public.planos p WHERE p.id = v_plano_id)
        ),
        'parcela', jsonb_build_object(
          'numero', v_numero_parcela,
          'vitalicia', COALESCE(v_regra.vitalicia, false),
          'vitalicia_inicio_parcela', v_regra.vitalicia_inicio_parcela
        ),
        'regra_aplicada', jsonb_build_object(
          'id', v_regra.id,
          'role', v_regra.role,
          'nome_nivel', COALESCE(v_regra.nome_nivel, v_regra.role),
          'tipo_comissao', v_regra.tipo_comissao,
          'valor', v_regra.valor
        ),
        'cadeia', jsonb_build_object(
          'vendedor_id', v_vendedor_id,
          'supervisor_id', v_cadeia.supervisor_id,
          'gerente_id', v_cadeia.gerente_id,
          'agencia_id', v_cadeia.agencia_id,
          'destinatario_id', v_destinatario_id
        ),
        'valores', jsonb_build_object(
          'valor_base', v_valor_base,
          'percentual_aplicado', v_percentual,
          'valor_comissao', v_valor_comissao,
          'valor_total', v_valor_comissao
        ),
        'snapshot_grade', v_snapshot
      )
    )
    ON CONFLICT (cobranca_id, vendedor_id, nivel_nome) WHERE cobranca_id IS NOT NULL
    DO NOTHING;

    IF FOUND THEN
      v_inseridos := v_inseridos + 1;
    END IF;
  END LOOP;

  RETURN v_inseridos;
END;
$function$;
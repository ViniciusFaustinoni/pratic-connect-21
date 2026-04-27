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
  v_valor_comissao_total numeric;
  v_valor_comissao numeric;
  v_percentual numeric;
  v_percentual_aplicado numeric;
  v_auto_pago_agencia_adesao_dinheiro boolean;
  v_status_comissao text;
  v_pago_em timestamptz;
  v_observacoes text;
  v_inseridos integer := 0;
  v_supervisores_count integer;
  v_supervisor record;
  v_split_mode text;
  v_idx integer;
  v_nivel_nome text;
  v_supervisores_array jsonb;
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
    SELECT 1 FROM public.grade_comissao_planos gcp
    WHERE gcp.grade_id = v_grade_id AND gcp.plano_id = v_plano_id AND gcp.ativo = true
  ) THEN
    RETURN 0;
  END IF;

  v_numero_parcela := public.fn_determinar_numero_parcela_cobranca(p_cobranca_id);
  SELECT * INTO v_cadeia FROM public.fn_resolver_cadeia(v_vendedor_id, v_data_venda) LIMIT 1;

  -- Snapshot dos supervisores ativos (para auditoria)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'supervisor_id', s.supervisor_id,
    'percentual_personalizado', s.percentual_personalizado,
    'ordem', s.ordem
  ) ORDER BY s.ordem), '[]'::jsonb)
  INTO v_supervisores_array
  FROM public.fn_listar_supervisores_vendedor(v_vendedor_id, v_data_venda) s;

  FOR v_regra IN
    WITH candidatas AS (
      SELECT r.*,
             CASE
               WHEN r.vitalicia = false AND r.parcela_numero = v_numero_parcela THEN 1
               WHEN r.vitalicia = true AND v_numero_parcela >= COALESCE(r.vitalicia_inicio_parcela, r.parcela_numero, 2) THEN 2
               ELSE 9
             END AS prioridade
      FROM public.grade_comissao_plano_regras r
      WHERE r.grade_id = v_grade_id AND r.plano_id = v_plano_id AND r.ativo = true
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

    -- Caso especial: supervisor_vendas pode ter múltiplos destinatários
    IF v_regra.role = 'supervisor_vendas' THEN
      v_supervisores_count := jsonb_array_length(v_supervisores_array);

      -- Fallback: nenhum supervisor cadastrado → usa o singular legado se existir
      IF v_supervisores_count = 0 THEN
        IF v_cadeia.supervisor_id IS NOT NULL THEN
          v_supervisores_array := jsonb_build_array(jsonb_build_object(
            'supervisor_id', v_cadeia.supervisor_id,
            'percentual_personalizado', NULL,
            'ordem', 0
          ));
          v_supervisores_count := 1;
        ELSE
          CONTINUE;
        END IF;
      END IF;

      -- Modo de divisão da parcela (igual | personalizado)
      SELECT COALESCE(parc.supervisor_split_mode, 'igual')
      INTO v_split_mode
      FROM public.grades_comissao_parcelas parc
      WHERE parc.id = v_regra.parcela_id;

      IF v_regra.tipo_comissao = 'valor_fixo' THEN
        v_valor_comissao_total := ROUND(v_regra.valor, 2);
        v_percentual_aplicado := 0;
      ELSE
        v_percentual_aplicado := v_regra.valor;
        v_valor_comissao_total := ROUND(v_valor_base * v_regra.valor / 100.0, 2);
      END IF;

      v_idx := 0;
      FOR v_supervisor IN
        SELECT (item->>'supervisor_id')::uuid AS supervisor_id,
               NULLIF(item->>'percentual_personalizado','')::numeric AS percentual_personalizado
        FROM jsonb_array_elements(v_supervisores_array) AS item
      LOOP
        v_idx := v_idx + 1;
        v_destinatario_id := v_supervisor.supervisor_id;
        IF v_destinatario_id IS NULL THEN CONTINUE; END IF;

        IF v_split_mode = 'personalizado' AND v_supervisor.percentual_personalizado IS NOT NULL THEN
          v_valor_comissao := ROUND(v_valor_comissao_total * v_supervisor.percentual_personalizado / 100.0, 2);
          v_percentual := ROUND(v_percentual_aplicado * v_supervisor.percentual_personalizado / 100.0, 4);
        ELSE
          -- Igual (também é o fallback quando personalizado sem percentual definido)
          v_valor_comissao := ROUND(v_valor_comissao_total / v_supervisores_count, 2);
          v_percentual := ROUND(v_percentual_aplicado / v_supervisores_count, 4);
        END IF;

        v_nivel_nome := COALESCE(v_regra.nome_nivel, v_regra.role)
                        || CASE WHEN v_supervisores_count > 1
                                THEN ' (' || v_idx || '/' || v_supervisores_count || ')'
                                ELSE '' END;

        INSERT INTO public.comissoes (
          vendedor_id, contrato_id, associado_id, cobranca_id,
          grade_id, grade_versao_id, plano_id, plano_regra_id,
          role_destinatario, tipo_calculo, tipo_comissao, nivel_nome,
          parcela_numero, valor_base, percentual_aplicado, valor_comissao, valor_total,
          status, pago_em, mes_referencia, ano_referencia, observacoes, calculo_snapshot
        ) VALUES (
          v_destinatario_id, v_contrato.id, v_cobranca.associado_id, p_cobranca_id,
          v_grade_id, v_grade_versao_id, v_plano_id, v_regra.id,
          v_regra.role,
          CASE WHEN v_numero_parcela = 1 THEN 'adesao' ELSE 'recorrente' END,
          v_regra.tipo_comissao, v_nivel_nome,
          v_numero_parcela, v_valor_base, v_percentual, v_valor_comissao, v_valor_comissao,
          'pendente', NULL,
          EXTRACT(MONTH FROM COALESCE(v_cobranca.data_pagamento, CURRENT_DATE))::integer,
          EXTRACT(YEAR FROM COALESCE(v_cobranca.data_pagamento, CURRENT_DATE))::integer,
          'Gerada automaticamente: split de supervisão (' || v_split_mode || ', ' || v_idx || '/' || v_supervisores_count || ')',
          jsonb_build_object(
            'split', jsonb_build_object(
              'mode', v_split_mode,
              'index', v_idx,
              'total_supervisores', v_supervisores_count,
              'valor_total_supervisao', v_valor_comissao_total,
              'percentual_total_supervisao', v_percentual_aplicado
            ),
            'grade', jsonb_build_object('id', v_grade_id, 'versao_id', v_grade_versao_id),
            'plano', jsonb_build_object('id', v_plano_id),
            'parcela', jsonb_build_object(
              'numero', v_numero_parcela,
              'vitalicia', COALESCE(v_regra.vitalicia, false),
              'vitalicia_inicio_parcela', v_regra.vitalicia_inicio_parcela
            ),
            'regra_aplicada', jsonb_build_object(
              'id', v_regra.id, 'role', v_regra.role,
              'nome_nivel', COALESCE(v_regra.nome_nivel, v_regra.role),
              'tipo_comissao', v_regra.tipo_comissao, 'valor', v_regra.valor
            ),
            'cadeia', jsonb_build_object(
              'vendedor_id', v_vendedor_id,
              'supervisores', v_supervisores_array,
              'gerente_id', v_cadeia.gerente_id,
              'agencia_id', v_cadeia.agencia_id,
              'destinatario_id', v_destinatario_id
            ),
            'cobranca', jsonb_build_object(
              'tipo', v_cobranca.tipo,
              'forma_pagamento', v_cobranca.forma_pagamento,
              'data_pagamento', v_cobranca.data_pagamento
            )
          )
        )
        ON CONFLICT (cobranca_id, vendedor_id, nivel_nome) WHERE cobranca_id IS NOT NULL
        DO NOTHING;

        IF FOUND THEN
          v_inseridos := v_inseridos + 1;
        END IF;
      END LOOP;

      CONTINUE; -- já tratamos esta regra, vai para a próxima
    END IF;

    -- Roles não-supervisor: comportamento original 1:1
    v_destinatario_id := CASE v_regra.role
      WHEN 'vendedor_clt' THEN v_vendedor_id
      WHEN 'vendedor_externo' THEN v_vendedor_id
      WHEN 'gerente_comercial' THEN v_cadeia.gerente_id
      WHEN 'agencia' THEN v_cadeia.agencia_id
      ELSE NULL
    END;

    IF v_destinatario_id IS NULL THEN CONTINUE; END IF;

    IF v_regra.tipo_comissao = 'valor_fixo' THEN
      v_valor_comissao := ROUND(v_regra.valor, 2);
      v_percentual := 0;
    ELSE
      v_percentual := v_regra.valor;
      v_valor_comissao := ROUND(v_valor_base * v_regra.valor / 100.0, 2);
    END IF;

    v_auto_pago_agencia_adesao_dinheiro := (
      v_regra.role = 'agencia'
      AND v_numero_parcela = 1
      AND lower(COALESCE(v_cobranca.tipo, '')) IN ('adesao', 'adesão', 'taxa_adesao', 'taxa_adesão')
      AND lower(COALESCE(v_cobranca.forma_pagamento, '')) IN ('cash', 'dinheiro')
    );
    v_status_comissao := CASE WHEN v_auto_pago_agencia_adesao_dinheiro THEN 'paga' ELSE 'pendente' END;
    v_pago_em := CASE WHEN v_auto_pago_agencia_adesao_dinheiro THEN COALESCE(v_cobranca.data_pagamento::timestamptz, now()) ELSE NULL END;
    v_observacoes := CASE
      WHEN v_auto_pago_agencia_adesao_dinheiro THEN 'Comissão autoquitada: taxa de adesão recebida em dinheiro pela agência.'
      ELSE 'Gerada automaticamente por pagamento: grade/plano/perfil (parcela ' || v_numero_parcela || ')'
    END;

    INSERT INTO public.comissoes (
      vendedor_id, contrato_id, associado_id, cobranca_id,
      grade_id, grade_versao_id, plano_id, plano_regra_id,
      role_destinatario, tipo_calculo, tipo_comissao, nivel_nome,
      parcela_numero, valor_base, percentual_aplicado, valor_comissao, valor_total,
      status, pago_em, mes_referencia, ano_referencia, observacoes, calculo_snapshot
    ) VALUES (
      v_destinatario_id, v_contrato.id, v_cobranca.associado_id, p_cobranca_id,
      v_grade_id, v_grade_versao_id, v_plano_id, v_regra.id,
      v_regra.role,
      CASE WHEN v_numero_parcela = 1 THEN 'adesao' ELSE 'recorrente' END,
      v_regra.tipo_comissao, COALESCE(v_regra.nome_nivel, v_regra.role),
      v_numero_parcela, v_valor_base, v_percentual, v_valor_comissao, v_valor_comissao,
      v_status_comissao, v_pago_em,
      EXTRACT(MONTH FROM COALESCE(v_cobranca.data_pagamento, CURRENT_DATE))::integer,
      EXTRACT(YEAR FROM COALESCE(v_cobranca.data_pagamento, CURRENT_DATE))::integer,
      v_observacoes,
      jsonb_build_object(
        'autopagamento_agencia_adesao_dinheiro', v_auto_pago_agencia_adesao_dinheiro,
        'grade', jsonb_build_object('id', v_grade_id, 'versao_id', v_grade_versao_id),
        'plano', jsonb_build_object('id', v_plano_id),
        'parcela', jsonb_build_object(
          'numero', v_numero_parcela,
          'vitalicia', COALESCE(v_regra.vitalicia, false),
          'vitalicia_inicio_parcela', v_regra.vitalicia_inicio_parcela
        ),
        'regra_aplicada', jsonb_build_object(
          'id', v_regra.id, 'role', v_regra.role,
          'nome_nivel', COALESCE(v_regra.nome_nivel, v_regra.role),
          'tipo_comissao', v_regra.tipo_comissao, 'valor', v_regra.valor
        ),
        'cadeia', jsonb_build_object(
          'vendedor_id', v_vendedor_id,
          'supervisores', v_supervisores_array,
          'gerente_id', v_cadeia.gerente_id,
          'agencia_id', v_cadeia.agencia_id,
          'destinatario_id', v_destinatario_id
        ),
        'cobranca', jsonb_build_object(
          'tipo', v_cobranca.tipo,
          'forma_pagamento', v_cobranca.forma_pagamento,
          'data_pagamento', v_cobranca.data_pagamento
        )
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

GRANT EXECUTE ON FUNCTION public.fn_gerar_comissoes_por_pagamento(uuid) TO authenticated, service_role;
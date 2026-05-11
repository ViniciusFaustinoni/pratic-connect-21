
CREATE OR REPLACE FUNCTION public.calcular_comissao_contrato(p_contrato_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contrato RECORD;
  v_vendedor_id UUID;
  v_tipo_consultor VARCHAR;
  v_valor_adesao NUMERIC;
  v_tipo_atendimento VARCHAR;
  v_tipo_venda VARCHAR;
  v_mes INTEGER;
  v_ano INTEGER;
  v_deducoes JSONB := '[]'::jsonb;
  v_total_deducoes NUMERIC := 0;
  v_repasse NUMERIC;
  v_comissao_id UUID;
  v_isenta_adesao BOOLEAN;
BEGIN
  SELECT c.*, a.nome as associado_nome
  INTO v_contrato
  FROM contratos c
  LEFT JOIN associados a ON a.id = c.associado_id
  WHERE c.id = p_contrato_id AND c.status = 'ativo';

  IF v_contrato IS NULL THEN
    RETURN NULL;
  END IF;

  v_vendedor_id := v_contrato.vendedor_id;
  IF v_vendedor_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_comissao_id
  FROM comissoes
  WHERE contrato_id = p_contrato_id AND tipo_comissao = 'adesao';

  IF v_comissao_id IS NOT NULL THEN
    RETURN v_comissao_id;
  END IF;

  v_tipo_consultor := fn_tipo_consultor(v_vendedor_id);
  v_valor_adesao := COALESCE(v_contrato.valor_adesao, 0);
  v_tipo_atendimento := COALESCE(v_contrato.tipo_atendimento, 'volante');
  v_tipo_venda := COALESCE(v_contrato.tipo_venda, 'nova');
  v_mes := EXTRACT(MONTH FROM COALESCE(v_contrato.data_ativacao, now()));
  v_ano := EXTRACT(YEAR FROM COALESCE(v_contrato.data_ativacao, now()));

  -- Adesão isenta: não há valor para descontar repasse do vendedor
  v_isenta_adesao := COALESCE(v_contrato.cenario_adesao, '') IN ('isenta_base', 'isenta_rota')
                     OR v_valor_adesao = 0;

  -- 1. Repasse volante (R$50) — apenas em vendas com adesão cobrada
  IF v_tipo_atendimento = 'volante' AND NOT v_isenta_adesao THEN
    v_repasse := COALESCE(fn_parametro_comissao('repasse_volante'), 50);
    v_deducoes := v_deducoes || jsonb_build_object('tipo', 'repasse_volante', 'valor', v_repasse);
    v_total_deducoes := v_total_deducoes + v_repasse;
  END IF;

  INSERT INTO comissoes (
    vendedor_id, contrato_id, mes_referencia, ano_referencia,
    tipo_comissao, valor_base, valor_bruto, valor_deducoes, deducoes_detalhes,
    associado_id, percentual_aplicado, valor_comissao, valor_total, status
  ) VALUES (
    v_vendedor_id, p_contrato_id, v_mes, v_ano,
    'adesao', v_valor_adesao, v_valor_adesao, v_total_deducoes, v_deducoes,
    v_contrato.associado_id, 0, 0, 0, 'pendente'
  )
  RETURNING id INTO v_comissao_id;

  IF v_tipo_atendimento = 'volante' AND NOT v_isenta_adesao THEN
    INSERT INTO comissoes_deducoes (vendedor_id, tipo, valor, contrato_id, associado_id, descricao)
    VALUES (v_vendedor_id, 'repasse_volante', v_repasse, p_contrato_id, v_contrato.associado_id,
            'Repasse obrigatório por atendimento volante - ' || COALESCE(v_contrato.associado_nome, ''));
  END IF;

  UPDATE associados
  SET vendedor_original_id = COALESCE(vendedor_original_id, v_vendedor_id)
  WHERE id = v_contrato.associado_id;

  RETURN v_comissao_id;
END;
$function$;

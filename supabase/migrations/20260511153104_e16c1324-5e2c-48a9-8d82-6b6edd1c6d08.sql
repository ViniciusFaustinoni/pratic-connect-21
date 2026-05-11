UPDATE comissoes_parametros SET valor = '25.00' WHERE chave = 'repasse_volante' AND valor = '50.00';
UPDATE configuracoes SET valor = '25' WHERE chave IN ('taxa_repasse_volante','taxa_repasse_volante_externo') AND valor = '50';

CREATE OR REPLACE FUNCTION public.calcular_comissao_contrato(p_contrato_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contrato RECORD;
  v_vendedor_id UUID;
  v_valor_adesao NUMERIC;
  v_tipo_atendimento VARCHAR;
  v_cenario_adesao VARCHAR;
  v_mes INTEGER;
  v_ano INTEGER;
  v_deducoes JSONB := '[]'::jsonb;
  v_total_deducoes NUMERIC := 0;
  v_repasse NUMERIC;
  v_comissao_id UUID;
  v_isenta_adesao BOOLEAN;
BEGIN
  SELECT c.*, a.nome AS associado_nome, q.cenario_adesao AS cot_cenario
  INTO v_contrato
  FROM contratos c
  LEFT JOIN associados a ON a.id = c.associado_id
  LEFT JOIN cotacoes q ON q.id = c.cotacao_id
  WHERE c.id = p_contrato_id AND c.status = 'ativo';
  IF v_contrato IS NULL THEN RETURN NULL; END IF;
  v_vendedor_id := v_contrato.vendedor_id;
  IF v_vendedor_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_comissao_id FROM comissoes
  WHERE contrato_id = p_contrato_id AND tipo_comissao = 'adesao';
  IF v_comissao_id IS NOT NULL THEN RETURN v_comissao_id; END IF;

  v_valor_adesao := COALESCE(v_contrato.valor_adesao, 0);
  v_tipo_atendimento := COALESCE(v_contrato.tipo_atendimento, 'volante');
  v_cenario_adesao := COALESCE(v_contrato.cot_cenario, '');
  v_mes := EXTRACT(MONTH FROM COALESCE(v_contrato.data_ativacao, now()));
  v_ano := EXTRACT(YEAR FROM COALESCE(v_contrato.data_ativacao, now()));

  v_isenta_adesao := v_cenario_adesao IN ('isenta_base','isenta_rota')
                     OR v_valor_adesao = 0;

  IF v_tipo_atendimento = 'volante' AND NOT v_isenta_adesao THEN
    v_repasse := COALESCE(fn_parametro_comissao('repasse_volante'), 25);
    v_deducoes := v_deducoes || jsonb_build_object('tipo','repasse_volante','valor',v_repasse);
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
  ) RETURNING id INTO v_comissao_id;

  IF v_tipo_atendimento = 'volante' AND NOT v_isenta_adesao THEN
    INSERT INTO comissoes_deducoes (vendedor_id, tipo, valor, contrato_id, associado_id, descricao)
    VALUES (v_vendedor_id, 'repasse_volante', v_repasse, p_contrato_id, v_contrato.associado_id,
            'Repasse obrigatório por atendimento volante - ' || COALESCE(v_contrato.associado_nome,''));
  END IF;

  UPDATE associados SET vendedor_original_id = COALESCE(vendedor_original_id, v_vendedor_id)
  WHERE id = v_contrato.associado_id;

  RETURN v_comissao_id;
END;
$function$;

UPDATE comissoes_deducoes cd
SET valor = 25, descricao = COALESCE(descricao,'') || ' (ajustado 50→25)'
FROM contratos c
LEFT JOIN cotacoes q ON q.id = c.cotacao_id
WHERE cd.contrato_id = c.id
  AND cd.tipo = 'repasse_volante'
  AND cd.valor = 50
  AND COALESCE(q.cenario_adesao,'') NOT IN ('isenta_base','isenta_rota')
  AND COALESCE(c.valor_adesao, 0) > 0;

UPDATE comissoes co
SET valor_deducoes = GREATEST(COALESCE(co.valor_deducoes,0) - 25, 0),
    deducoes_detalhes = (
      SELECT COALESCE(jsonb_agg(
        CASE WHEN (elem->>'tipo') = 'repasse_volante' AND (elem->>'valor')::numeric = 50
             THEN jsonb_set(elem, '{valor}', '25'::jsonb)
             ELSE elem END
      ), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(co.deducoes_detalhes,'[]'::jsonb)) elem
    )
FROM contratos c
LEFT JOIN cotacoes q ON q.id = c.cotacao_id
WHERE co.contrato_id = c.id
  AND co.tipo_comissao = 'adesao'
  AND COALESCE(q.cenario_adesao,'') NOT IN ('isenta_base','isenta_rota')
  AND COALESCE(c.valor_adesao, 0) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(co.deducoes_detalhes,'[]'::jsonb)) e
    WHERE (e->>'tipo') = 'repasse_volante' AND (e->>'valor')::numeric = 50
  );

COMMENT ON COLUMN contratos.tipo_atendimento IS 'volante ou base_administrativa - afeta repasse de R$25 nos cenários cobrados';
UPDATE comissoes_parametros SET descricao = 'Valor fixo de repasse por venda com atendimento volante (R$) - cenários cobrados' WHERE chave = 'repasse_volante';
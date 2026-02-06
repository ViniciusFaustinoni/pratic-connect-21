
-- ============================================
-- FUNÇÃO AUXILIAR: Determinar tipo do consultor
-- ============================================
CREATE OR REPLACE FUNCTION fn_tipo_consultor(p_vendedor_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_role app_role;
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM profiles WHERE id = p_vendedor_id;
  IF v_user_id IS NULL THEN RETURN 'outro'; END IF;
  
  SELECT role INTO v_role FROM user_roles WHERE user_id = v_user_id AND role IN ('vendedor_clt', 'vendedor_externo') LIMIT 1;
  
  IF v_role = 'vendedor_clt' THEN RETURN 'interno';
  ELSIF v_role = 'vendedor_externo' THEN RETURN 'externo';
  ELSE RETURN 'outro';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO AUXILIAR: Tempo de casa do consultor
-- ============================================
CREATE OR REPLACE FUNCTION fn_tempo_casa_consultor(p_vendedor_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_user_id UUID;
  v_data_admissao DATE;
  v_meses INTEGER;
BEGIN
  SELECT user_id INTO v_user_id FROM profiles WHERE id = p_vendedor_id;
  IF v_user_id IS NULL THEN RETURN 'menos_1_ano'; END IF;
  
  SELECT data_admissao INTO v_data_admissao FROM funcionarios WHERE usuario_id = v_user_id LIMIT 1;
  
  IF v_data_admissao IS NULL THEN RETURN 'menos_1_ano'; END IF;
  
  v_meses := EXTRACT(YEAR FROM age(CURRENT_DATE, v_data_admissao)) * 12 + EXTRACT(MONTH FROM age(CURRENT_DATE, v_data_admissao));
  
  IF v_meses >= 12 THEN RETURN 'mais_1_ano';
  ELSE RETURN 'menos_1_ano';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO AUXILIAR: Contar placas ativas do consultor
-- ============================================
CREATE OR REPLACE FUNCTION fn_placas_ativas_consultor(p_vendedor_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT a.id)
  INTO v_count
  FROM associados a
  JOIN contratos c ON c.associado_id = a.id
  WHERE c.vendedor_id = p_vendedor_id
    AND a.status = 'ativo'
    AND c.status = 'ativo';
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO AUXILIAR: Buscar parâmetro global
-- ============================================
CREATE OR REPLACE FUNCTION fn_parametro_comissao(p_chave VARCHAR)
RETURNS NUMERIC AS $$
DECLARE
  v_valor VARCHAR;
BEGIN
  SELECT valor INTO v_valor FROM comissoes_parametros WHERE chave = p_chave AND ativo = true;
  RETURN COALESCE(v_valor::NUMERIC, 0);
EXCEPTION WHEN OTHERS THEN
  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO PRINCIPAL: Calcular comissão ao ativar contrato
-- SUBSTITUI a versão anterior (mantém mesma assinatura UUID)
-- ============================================
CREATE OR REPLACE FUNCTION calcular_comissao_contrato(p_contrato_id UUID)
RETURNS UUID AS $$
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
BEGIN
  -- Buscar dados do contrato
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

  -- Verificar se já existe comissão para este contrato (evitar duplicação)
  SELECT id INTO v_comissao_id 
  FROM comissoes 
  WHERE contrato_id = p_contrato_id AND tipo_comissao = 'adesao';
  
  IF v_comissao_id IS NOT NULL THEN
    RETURN v_comissao_id; -- Já calculada, retornar ID existente
  END IF;

  v_tipo_consultor := fn_tipo_consultor(v_vendedor_id);
  v_valor_adesao := COALESCE(v_contrato.valor_adesao, 0);
  v_tipo_atendimento := COALESCE(v_contrato.tipo_atendimento, 'volante');
  v_tipo_venda := COALESCE(v_contrato.tipo_venda, 'nova');
  v_mes := EXTRACT(MONTH FROM COALESCE(v_contrato.data_ativacao, now()));
  v_ano := EXTRACT(YEAR FROM COALESCE(v_contrato.data_ativacao, now()));

  -- Calcular deduções
  -- 1. Repasse volante (R$50 se atendimento volante)
  IF v_tipo_atendimento = 'volante' THEN
    v_repasse := COALESCE(fn_parametro_comissao('repasse_volante'), 50);
    v_deducoes := v_deducoes || jsonb_build_object('tipo', 'repasse_volante', 'valor', v_repasse);
    v_total_deducoes := v_total_deducoes + v_repasse;
  END IF;

  -- Inserir comissão (status 'pendente' — será calculada no fechamento mensal)
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

  -- Registrar deduções individuais
  IF v_tipo_atendimento = 'volante' THEN
    INSERT INTO comissoes_deducoes (vendedor_id, tipo, valor, contrato_id, associado_id, descricao)
    VALUES (v_vendedor_id, 'repasse_volante', v_repasse, p_contrato_id, v_contrato.associado_id, 
            'Repasse obrigatório por atendimento volante - ' || COALESCE(v_contrato.associado_nome, ''));
  END IF;

  -- Atualizar vendedor_original_id no associado (se não existir)
  UPDATE associados 
  SET vendedor_original_id = COALESCE(vendedor_original_id, v_vendedor_id)
  WHERE id = v_contrato.associado_id;

  RETURN v_comissao_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO: Calcular bonificação mensal sobre adesões (Interno)
-- ============================================
CREATE OR REPLACE FUNCTION fn_calcular_bonificacao_adesao(
  p_vendedor_id UUID,
  p_mes INTEGER,
  p_ano INTEGER,
  p_campanha_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_tipo_consultor VARCHAR;
  v_total_vendas INTEGER;
  v_total_adesoes NUMERIC;
  v_percentual NUMERIC := 0;
  v_valor_bruto NUMERIC;
  v_total_deducoes NUMERIC := 0;
  v_valor_liquido NUMERIC;
  v_antecipado_folha NUMERIC;
  v_resultado JSONB;
BEGIN
  v_tipo_consultor := fn_tipo_consultor(p_vendedor_id);
  
  -- Só internos têm bonificação sobre adesão
  IF v_tipo_consultor != 'interno' THEN
    RETURN jsonb_build_object('aplicavel', false, 'motivo', 'Apenas consultores internos');
  END IF;

  -- Contar vendas confirmadas no mês (contratos ativos com adesão paga)
  SELECT 
    COUNT(*),
    COALESCE(SUM(c.valor_adesao), 0)
  INTO v_total_vendas, v_total_adesoes
  FROM contratos c
  WHERE c.vendedor_id = p_vendedor_id
    AND c.status = 'ativo'
    AND c.adesao_paga = true
    AND EXTRACT(MONTH FROM c.data_ativacao) = p_mes
    AND EXTRACT(YEAR FROM c.data_ativacao) = p_ano;

  -- Buscar percentual da faixa (maior faixa que atinge)
  SELECT percentual_adesao INTO v_percentual
  FROM comissoes_faixas_adesao
  WHERE tipo_consultor = 'interno'
    AND quantidade_vendas_minima <= v_total_vendas
    AND ativo = true
  ORDER BY quantidade_vendas_minima DESC
  LIMIT 1;

  v_percentual := COALESCE(v_percentual, 0);
  v_valor_bruto := v_total_adesoes * (v_percentual / 100);

  -- Calcular deduções totais do mês
  SELECT COALESCE(SUM(valor), 0) INTO v_total_deducoes
  FROM comissoes_deducoes
  WHERE vendedor_id = p_vendedor_id
    AND EXTRACT(MONTH FROM aplicada_em) = p_mes
    AND EXTRACT(YEAR FROM aplicada_em) = p_ano;

  -- 10% antecipado em folha (padrão se não configurado)
  v_antecipado_folha := v_total_adesoes * (COALESCE(fn_parametro_comissao('percentual_antecipado_folha'), 10) / 100);

  -- Valor líquido = bruto - deduções - antecipado
  v_valor_liquido := GREATEST(v_valor_bruto - v_total_deducoes - v_antecipado_folha, 0);

  v_resultado := jsonb_build_object(
    'aplicavel', true,
    'total_vendas', v_total_vendas,
    'total_adesoes', v_total_adesoes,
    'percentual', v_percentual,
    'valor_bruto', v_valor_bruto,
    'total_deducoes', v_total_deducoes,
    'antecipado_folha', v_antecipado_folha,
    'valor_liquido', v_valor_liquido
  );

  -- Atualizar comissões pendentes do mês com o percentual correto
  UPDATE comissoes 
  SET percentual_aplicado = v_percentual,
      valor_comissao = valor_base * (v_percentual / 100),
      valor_total = GREATEST(valor_base * (v_percentual / 100) - valor_deducoes, 0),
      updated_at = now()
  WHERE vendedor_id = p_vendedor_id
    AND mes_referencia = p_mes
    AND ano_referencia = p_ano
    AND tipo_comissao = 'adesao'
    AND status = 'pendente';

  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO: Calcular comissão recorrente
-- ============================================
CREATE OR REPLACE FUNCTION fn_calcular_recorrente(
  p_vendedor_id UUID,
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_tipo_consultor VARCHAR;
  v_placas_ativas INTEGER;
  v_total_boletos NUMERIC;
  v_percentual NUMERIC := 0;
  v_valor_recorrente NUMERIC;
  v_minimo_garantido NUMERIC := 0;
  v_mes_anterior INTEGER;
  v_ano_anterior INTEGER;
  v_resultado JSONB;
BEGIN
  v_tipo_consultor := fn_tipo_consultor(p_vendedor_id);
  v_placas_ativas := fn_placas_ativas_consultor(p_vendedor_id);

  -- Calcular mês anterior
  IF p_mes = 1 THEN
    v_mes_anterior := 12;
    v_ano_anterior := p_ano - 1;
  ELSE
    v_mes_anterior := p_mes - 1;
    v_ano_anterior := p_ano;
  END IF;

  -- Verificar mínimo (interno precisa de 10+ placas)
  IF v_tipo_consultor = 'interno' AND v_placas_ativas < COALESCE(fn_parametro_comissao('minimo_placas_recorrente_interno'), 10) THEN
    RETURN jsonb_build_object('aplicavel', false, 'motivo', 'Abaixo do mínimo de placas', 'placas_ativas', v_placas_ativas);
  END IF;

  -- Somar boletos pagos no mês anterior pela base ativa do consultor
  SELECT COALESCE(SUM(ac.valor), 0) INTO v_total_boletos
  FROM asaas_cobrancas ac
  JOIN contratos c ON c.id = ac.contrato_id
  WHERE c.vendedor_id = p_vendedor_id
    AND ac.status IN ('RECEIVED', 'CONFIRMED', 'pago')
    AND ac.tipo IN ('mensalidade', 'RECURRENCE')
    AND ac.mes_referencia = v_mes_anterior
    AND ac.ano_referencia = v_ano_anterior;

  -- Buscar percentual da faixa
  SELECT percentual_recorrente INTO v_percentual
  FROM comissoes_faixas_recorrente
  WHERE tipo_consultor = v_tipo_consultor
    AND placas_minima <= v_placas_ativas
    AND (placas_maxima IS NULL OR placas_maxima >= v_placas_ativas)
    AND ativo = true
  ORDER BY placas_minima DESC
  LIMIT 1;

  -- Verificar mínimo garantido por crescimento
  SELECT COALESCE(MAX(percentual_recorrente_garantido), 0) INTO v_minimo_garantido
  FROM comissoes_crescimento_log
  WHERE vendedor_id = p_vendedor_id;

  -- Usar o MAIOR entre faixa normal e mínimo garantido
  v_percentual := GREATEST(COALESCE(v_percentual, 0), v_minimo_garantido);
  v_valor_recorrente := v_total_boletos * (v_percentual / 100);

  -- Inserir ou atualizar registro de recorrente
  INSERT INTO comissoes_recorrentes (vendedor_id, mes_referencia, ano_referencia, placas_ativas, total_boletos_pagos, percentual_aplicado, valor_recorrente, status)
  VALUES (p_vendedor_id, p_mes, p_ano, v_placas_ativas, v_total_boletos, v_percentual, v_valor_recorrente, 'calculada')
  ON CONFLICT (vendedor_id, mes_referencia, ano_referencia) 
  DO UPDATE SET placas_ativas = EXCLUDED.placas_ativas, total_boletos_pagos = EXCLUDED.total_boletos_pagos,
    percentual_aplicado = EXCLUDED.percentual_aplicado, valor_recorrente = EXCLUDED.valor_recorrente, updated_at = now();

  RETURN jsonb_build_object(
    'aplicavel', true,
    'tipo_consultor', v_tipo_consultor,
    'placas_ativas', v_placas_ativas,
    'total_boletos', v_total_boletos,
    'percentual', v_percentual,
    'minimo_garantido', v_minimo_garantido,
    'valor_recorrente', v_valor_recorrente
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO: Calcular produção mensal (externo)
-- ============================================
CREATE OR REPLACE FUNCTION fn_calcular_producao(
  p_vendedor_id UUID,
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_tipo_consultor VARCHAR;
  v_placas_confirmadas INTEGER;
  v_valor_producao NUMERIC := 0;
BEGIN
  v_tipo_consultor := fn_tipo_consultor(p_vendedor_id);
  
  IF v_tipo_consultor != 'externo' THEN
    RETURN jsonb_build_object('aplicavel', false, 'motivo', 'Apenas consultores externos');
  END IF;

  -- Contar vendas confirmadas (contratos ativos + adesão paga) no mês
  SELECT COUNT(*) INTO v_placas_confirmadas
  FROM contratos c
  WHERE c.vendedor_id = p_vendedor_id
    AND c.status = 'ativo'
    AND c.adesao_paga = true
    AND EXTRACT(MONTH FROM c.data_ativacao) = p_mes
    AND EXTRACT(YEAR FROM c.data_ativacao) = p_ano;

  -- Buscar valor da faixa
  SELECT valor_remuneracao INTO v_valor_producao
  FROM comissoes_faixas_producao
  WHERE tipo_consultor = 'externo'
    AND placas_confirmadas_minima <= v_placas_confirmadas
    AND ativo = true
  ORDER BY placas_confirmadas_minima DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'aplicavel', v_valor_producao IS NOT NULL AND v_valor_producao > 0,
    'placas_confirmadas', v_placas_confirmadas,
    'valor_producao', COALESCE(v_valor_producao, 0),
    'minimo_necessario', COALESCE(fn_parametro_comissao('minimo_placas_producao_externo'), 30)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO: Verificar e registrar crescimento de base
-- ============================================
CREATE OR REPLACE FUNCTION fn_verificar_crescimento(
  p_vendedor_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_tipo_consultor VARCHAR;
  v_placas_ativas INTEGER;
  v_ultimo_marco INTEGER;
  v_proximo_marco INTEGER;
  v_faixa RECORD;
  v_novos_marcos JSONB := '[]'::jsonb;
BEGIN
  v_tipo_consultor := fn_tipo_consultor(p_vendedor_id);
  v_placas_ativas := fn_placas_ativas_consultor(p_vendedor_id);

  -- Último marco atingido
  SELECT COALESCE(MAX(marco_placas), 0) INTO v_ultimo_marco
  FROM comissoes_crescimento_log
  WHERE vendedor_id = p_vendedor_id;

  -- Verificar se atingiu novos marcos
  FOR v_faixa IN 
    SELECT * FROM comissoes_faixas_crescimento
    WHERE (tipo_consultor = v_tipo_consultor OR tipo_consultor = 'todos')
      AND placas_confirmadas > v_ultimo_marco
      AND placas_confirmadas <= v_placas_ativas
      AND ativo = true
    ORDER BY placas_confirmadas ASC
  LOOP
    -- Registrar novo marco
    INSERT INTO comissoes_crescimento_log (vendedor_id, marco_placas, valor_pago, percentual_recorrente_garantido)
    VALUES (p_vendedor_id, v_faixa.placas_confirmadas, v_faixa.valor_remuneracao, v_faixa.percentual_minimo_recorrente)
    ON CONFLICT (vendedor_id, marco_placas) DO NOTHING;

    v_novos_marcos := v_novos_marcos || jsonb_build_object(
      'marco', v_faixa.placas_confirmadas,
      'valor', v_faixa.valor_remuneracao,
      'recorrente_garantido', v_faixa.percentual_minimo_recorrente
    );
  END LOOP;

  -- Próximo marco
  SELECT MIN(placas_confirmadas) INTO v_proximo_marco
  FROM comissoes_faixas_crescimento
  WHERE (tipo_consultor = v_tipo_consultor OR tipo_consultor = 'todos')
    AND placas_confirmadas > v_placas_ativas
    AND ativo = true;

  RETURN jsonb_build_object(
    'placas_ativas', v_placas_ativas,
    'ultimo_marco', v_ultimo_marco,
    'proximo_marco', v_proximo_marco,
    'novos_marcos', v_novos_marcos
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO: Verificar recorde pessoal
-- ============================================
CREATE OR REPLACE FUNCTION fn_verificar_recorde(
  p_vendedor_id UUID,
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_vendas_mes INTEGER;
  v_recorde_atual INTEGER;
  v_bonus_recorde NUMERIC;
  v_novo_recorde BOOLEAN := false;
BEGIN
  SELECT user_id INTO v_user_id FROM profiles WHERE id = p_vendedor_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('aplicavel', false, 'motivo', 'Vendedor não encontrado');
  END IF;

  -- Vendas confirmadas no mês
  SELECT COUNT(*) INTO v_vendas_mes
  FROM contratos c
  WHERE c.vendedor_id = p_vendedor_id
    AND c.status = 'ativo'
    AND c.adesao_paga = true
    AND EXTRACT(MONTH FROM c.data_ativacao) = p_mes
    AND EXTRACT(YEAR FROM c.data_ativacao) = p_ano;

  -- Recorde atual
  SELECT COALESCE(recorde_vendas_mensal, 0) INTO v_recorde_atual
  FROM funcionarios
  WHERE usuario_id = v_user_id;

  IF v_vendas_mes > COALESCE(v_recorde_atual, 0) THEN
    v_novo_recorde := true;
    v_bonus_recorde := COALESCE(fn_parametro_comissao('bonus_recorde'), 2000);
    
    -- Atualizar recorde
    UPDATE funcionarios 
    SET recorde_vendas_mensal = v_vendas_mes,
        mes_recorde = p_mes,
        ano_recorde = p_ano
    WHERE usuario_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'vendas_mes', v_vendas_mes,
    'recorde_anterior', COALESCE(v_recorde_atual, 0),
    'novo_recorde', v_novo_recorde,
    'bonus', CASE WHEN v_novo_recorde THEN v_bonus_recorde ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO: Calcular ranking mensal da campanha
-- ============================================
CREATE OR REPLACE FUNCTION fn_calcular_ranking_campanha(
  p_campanha_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_campanha RECORD;
  v_vendedor RECORD;
  v_posicao INTEGER;
  v_tipo VARCHAR;
  v_categoria VARCHAR;
  v_faixa_placas INTEGER;
  v_total_placas_campanha INTEGER;
  v_premio NUMERIC;
BEGIN
  SELECT * INTO v_campanha FROM comissoes_campanhas WHERE id = p_campanha_id;
  IF v_campanha IS NULL THEN RETURN; END IF;

  -- Limpar ranking anterior desta campanha
  DELETE FROM comissoes_ranking_mensal WHERE campanha_id = p_campanha_id;

  -- Calcular vendas de cada vendedor
  FOR v_vendedor IN
    SELECT DISTINCT c.vendedor_id,
      fn_tipo_consultor(c.vendedor_id) as tipo_consultor,
      fn_tempo_casa_consultor(c.vendedor_id) as categoria_tempo,
      fn_placas_ativas_consultor(c.vendedor_id) as placas_ativas,
      COUNT(*) FILTER (WHERE c.status = 'ativo' AND c.adesao_paga = true) as vendas_confirmadas,
      COUNT(*) FILTER (WHERE c.status = 'cancelado') as vendas_canceladas,
      COUNT(*) FILTER (WHERE c.tipo_venda = 'troca_titularidade' AND c.status = 'ativo') as trocas_titularidade
    FROM contratos c
    WHERE c.vendedor_id IS NOT NULL
      AND EXTRACT(MONTH FROM c.data_ativacao) = v_campanha.mes
      AND EXTRACT(YEAR FROM c.data_ativacao) = v_campanha.ano
    GROUP BY c.vendedor_id
  LOOP
    INSERT INTO comissoes_ranking_mensal (
      campanha_id, vendedor_id, tipo_consultor, categoria_tempo,
      vendas_confirmadas, vendas_canceladas, trocas_titularidade,
      vendas_liquidas, placas_ativas
    ) VALUES (
      p_campanha_id, v_vendedor.vendedor_id, v_vendedor.tipo_consultor, v_vendedor.categoria_tempo,
      v_vendedor.vendas_confirmadas, v_vendedor.vendas_canceladas, v_vendedor.trocas_titularidade,
      v_vendedor.vendas_confirmadas - v_vendedor.vendas_canceladas + (v_vendedor.trocas_titularidade * 0.5),
      v_vendedor.placas_ativas
    );
  END LOOP;

  -- Calcular total de placas da campanha para determinar faixa de prêmio
  SELECT COALESCE(SUM(vendas_confirmadas), 0) INTO v_total_placas_campanha
  FROM comissoes_ranking_mensal WHERE campanha_id = p_campanha_id;

  -- Determinar faixa de placas (300, 400, 500)
  IF v_total_placas_campanha >= 500 THEN v_faixa_placas := 500;
  ELSIF v_total_placas_campanha >= 400 THEN v_faixa_placas := 400;
  ELSIF v_total_placas_campanha >= 300 THEN v_faixa_placas := 300;
  ELSE v_faixa_placas := 0;
  END IF;

  -- Atribuir posições e prêmios por grupo (tipo_consultor + categoria_tempo)
  FOR v_tipo IN SELECT DISTINCT tipo_consultor FROM comissoes_ranking_mensal WHERE campanha_id = p_campanha_id
  LOOP
    FOR v_categoria IN SELECT DISTINCT categoria_tempo FROM comissoes_ranking_mensal WHERE campanha_id = p_campanha_id AND tipo_consultor = v_tipo
    LOOP
      v_posicao := 0;
      FOR v_vendedor IN
        SELECT id, vendedor_id, vendas_liquidas
        FROM comissoes_ranking_mensal
        WHERE campanha_id = p_campanha_id AND tipo_consultor = v_tipo AND categoria_tempo = v_categoria
        ORDER BY vendas_liquidas DESC, vendedor_id ASC -- ordem determinística
      LOOP
        v_posicao := v_posicao + 1;
        
        -- Buscar prêmio
        v_premio := 0;
        IF v_faixa_placas > 0 AND v_posicao <= 3 THEN
          SELECT COALESCE(valor_premio, 0) INTO v_premio
          FROM comissoes_faixas_classificacao
          WHERE tipo_consultor = v_tipo
            AND (categoria_tempo = v_categoria OR categoria_tempo = 'todos')
            AND posicao_ranking = v_posicao
            AND faixa_placas_base = v_faixa_placas
            AND ativo = true
          LIMIT 1;
        END IF;

        UPDATE comissoes_ranking_mensal
        SET posicao_ranking = v_posicao, valor_premio = v_premio
        WHERE id = v_vendedor.id;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Atualizar totais na campanha
  UPDATE comissoes_campanhas
  SET total_vendas_confirmadas = v_total_placas_campanha,
      updated_at = now()
  WHERE id = p_campanha_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO MASTER: Fechamento mensal completo
-- ============================================
CREATE OR REPLACE FUNCTION fn_fechamento_mensal_comissoes(
  p_mes INTEGER,
  p_ano INTEGER,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_campanha_id UUID;
  v_vendedor RECORD;
  v_resultado_adesao JSONB;
  v_resultado_recorrente JSONB;
  v_resultado_producao JSONB;
  v_resultado_crescimento JSONB;
  v_resultado_recorde JSONB;
  v_resultados JSONB := '[]'::jsonb;
  v_dia_pagamento INTEGER;
  v_dia_apuracao INTEGER;
BEGIN
  -- Valores padrão com COALESCE
  v_dia_pagamento := COALESCE(fn_parametro_comissao('dia_pagamento_1a_fase')::INTEGER, 20);
  v_dia_apuracao := COALESCE(fn_parametro_comissao('dia_apuracao_boletos')::INTEGER, 10);

  -- Buscar ou criar campanha
  SELECT id INTO v_campanha_id FROM comissoes_campanhas WHERE mes = p_mes AND ano = p_ano;
  
  IF v_campanha_id IS NULL THEN
    INSERT INTO comissoes_campanhas (nome, mes, ano, data_inicio, data_fim, 
      data_pagamento_1a_fase, data_apuracao_boletos, data_pagamento_descontos, status)
    VALUES (
      'Campanha ' || LPAD(p_mes::TEXT, 2, '0') || '/' || p_ano,
      p_mes, p_ano,
      make_date(p_ano, p_mes, 1),
      (make_date(p_ano, p_mes, 1) + interval '1 month' - interval '1 day')::date,
      make_date(p_ano, p_mes, LEAST(v_dia_pagamento, 28)),
      make_date(CASE WHEN p_mes = 12 THEN p_ano + 1 ELSE p_ano END, CASE WHEN p_mes = 12 THEN 1 ELSE p_mes + 1 END, LEAST(v_dia_apuracao, 28)),
      make_date(CASE WHEN p_mes >= 11 THEN p_ano + 1 ELSE p_ano END, CASE WHEN p_mes >= 11 THEN p_mes - 10 ELSE p_mes + 2 END, LEAST(v_dia_pagamento, 28)),
      'aberta'
    )
    RETURNING id INTO v_campanha_id;
  END IF;

  -- Processar cada vendedor ativo
  FOR v_vendedor IN
    SELECT DISTINCT p.id as vendedor_id, p.nome
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role IN ('vendedor_clt', 'vendedor_externo')
      AND p.ativo = true
  LOOP
    -- 1. Bonificação sobre adesões (interno)
    v_resultado_adesao := fn_calcular_bonificacao_adesao(v_vendedor.vendedor_id, p_mes, p_ano, v_campanha_id);
    
    -- 2. Recorrente
    v_resultado_recorrente := fn_calcular_recorrente(v_vendedor.vendedor_id, p_mes, p_ano);
    
    -- 3. Produção (externo)
    v_resultado_producao := fn_calcular_producao(v_vendedor.vendedor_id, p_mes, p_ano);
    
    -- 4. Crescimento
    v_resultado_crescimento := fn_verificar_crescimento(v_vendedor.vendedor_id);
    
    -- 5. Recorde
    v_resultado_recorde := fn_verificar_recorde(v_vendedor.vendedor_id, p_mes, p_ano);

    v_resultados := v_resultados || jsonb_build_object(
      'vendedor_id', v_vendedor.vendedor_id,
      'nome', v_vendedor.nome,
      'adesao', v_resultado_adesao,
      'recorrente', v_resultado_recorrente,
      'producao', v_resultado_producao,
      'crescimento', v_resultado_crescimento,
      'recorde', v_resultado_recorde
    );
  END LOOP;

  -- 6. Calcular ranking
  PERFORM fn_calcular_ranking_campanha(v_campanha_id);

  -- Atualizar status da campanha
  UPDATE comissoes_campanhas 
  SET status = 'em_apuracao',
      updated_at = now()
  WHERE id = v_campanha_id;

  -- Registrar auditoria
  INSERT INTO comissoes_auditoria (tabela, registro_id, acao, dados_novos, usuario_id)
  VALUES ('comissoes_campanhas', v_campanha_id, 'fechamento', 
    jsonb_build_object('mes', p_mes, 'ano', p_ano, 'vendedores_processados', jsonb_array_length(v_resultados)),
    p_usuario_id);

  RETURN jsonb_build_object(
    'success', true,
    'campanha_id', v_campanha_id,
    'mes', p_mes,
    'ano', p_ano,
    'vendedores_processados', jsonb_array_length(v_resultados),
    'resultados', v_resultados
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'mes', p_mes,
    'ano', p_ano
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÃO: Estorno por cancelamento
-- ============================================
CREATE OR REPLACE FUNCTION fn_estorno_cancelamento()
RETURNS TRIGGER AS $$
DECLARE
  v_contrato RECORD;
  v_comissao RECORD;
BEGIN
  -- Evitar recursão: só processar se mudou para cancelado
  IF NEW.status = 'cancelado' AND (OLD.status IS NULL OR OLD.status != 'cancelado') THEN
    -- Registrar data de cancelamento
    NEW.data_cancelamento := COALESCE(NEW.data_cancelamento, now());
    
    -- Buscar contrato e comissão
    SELECT * INTO v_contrato FROM contratos WHERE associado_id = NEW.id AND status = 'ativo' LIMIT 1;
    
    IF v_contrato.vendedor_id IS NOT NULL THEN
      -- Buscar comissão de adesão
      SELECT * INTO v_comissao FROM comissoes 
      WHERE contrato_id = v_contrato.id AND tipo_comissao = 'adesao' AND status IN ('pendente', 'aprovada');

      IF v_comissao.id IS NOT NULL THEN
        -- Se comissão ainda pendente, cancelar
        IF v_comissao.status = 'pendente' THEN
          UPDATE comissoes SET status = 'cancelada', observacoes = 'Cancelamento do associado', updated_at = now()
          WHERE id = v_comissao.id;
        -- Se já aprovada, criar dedução para próximo mês
        ELSIF v_comissao.status = 'aprovada' THEN
          INSERT INTO comissoes_deducoes (vendedor_id, tipo, valor, contrato_id, associado_id, descricao)
          VALUES (v_contrato.vendedor_id, 'cancelamento', COALESCE(v_comissao.valor_total, 0),
                  v_contrato.id, NEW.id, 'Estorno por cancelamento do associado ' || NEW.nome);
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log do erro mas não bloqueia a operação
  RAISE NOTICE 'Erro em fn_estorno_cancelamento: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger de estorno (se não existir)
DROP TRIGGER IF EXISTS trigger_estorno_cancelamento ON associados;
CREATE TRIGGER trigger_estorno_cancelamento
  BEFORE UPDATE ON associados
  FOR EACH ROW
  WHEN (NEW.status = 'cancelado')
  EXECUTE FUNCTION fn_estorno_cancelamento();

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_comissoes_deducoes_vendedor_mes ON comissoes_deducoes(vendedor_id, aplicada_em);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_vendedor_periodo ON asaas_cobrancas(contrato_id, mes_referencia, ano_referencia);
CREATE INDEX IF NOT EXISTS idx_contratos_vendedor_ativacao ON contratos(vendedor_id, data_ativacao) WHERE status = 'ativo';
CREATE INDEX IF NOT EXISTS idx_comissoes_vendedor_periodo ON comissoes(vendedor_id, mes_referencia, ano_referencia);

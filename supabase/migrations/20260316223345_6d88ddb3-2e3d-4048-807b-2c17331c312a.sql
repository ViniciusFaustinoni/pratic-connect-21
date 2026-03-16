
-- =============================================
-- 1. Tabela pontuacao_eventos
-- =============================================
CREATE TABLE IF NOT EXISTS pontuacao_eventos (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id     UUID          NOT NULL REFERENCES profiles(id),
  tipo_operacao   VARCHAR(60)   NOT NULL,
  pontos          DECIMAL(4,1)  NOT NULL,
  conta_ranking   BOOLEAN       NOT NULL DEFAULT TRUE,
  contrato_id     UUID          REFERENCES contratos(id),
  referencia_tipo VARCHAR(40),
  referencia_id   UUID,
  mes_referencia  DATE          NOT NULL DEFAULT date_trunc('month', NOW()),
  estornado       BOOLEAN       NOT NULL DEFAULT FALSE,
  estorno_id      UUID          REFERENCES pontuacao_eventos(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE pontuacao_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pontuacao" ON pontuacao_eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita pontuacao" ON pontuacao_eventos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update pontuacao" ON pontuacao_eventos FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_pontuacao_vendedor ON pontuacao_eventos(vendedor_id);
CREATE INDEX idx_pontuacao_mes ON pontuacao_eventos(mes_referencia);
CREATE INDEX idx_pontuacao_contrato ON pontuacao_eventos(contrato_id);

-- =============================================
-- 2. Inserir parâmetros de pontuação
-- =============================================
INSERT INTO comissoes_parametros (chave, valor, descricao, tipo_dado) VALUES
  ('pontos_nova_adesao',                 '1.0', 'Pontos por nova adesão confirmada (1º boleto pago)', 'numero'),
  ('pontos_substituicao_placa',          '0.5', 'Pontos por substituição de placa', 'numero'),
  ('pontos_reativacao_120_dias',         '1.0', 'Pontos por reativação após 120 dias', 'numero'),
  ('pontos_cancelamento_antes_1_boleto', '0.0', 'Cancelamento antes do 1º boleto — não conta', 'numero')
ON CONFLICT (chave) DO NOTHING;

-- Renomear chave existente para consistência
UPDATE comissoes_parametros 
SET chave = 'pontos_troca_titularidade', 
    descricao = 'Pontos por troca de titularidade'
WHERE chave = 'troca_titularidade_peso_ranking';

-- =============================================
-- 3. Recriar fn_calcular_ranking_campanha com leitura dinâmica
-- =============================================
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
  v_peso_troca NUMERIC;
BEGIN
  SELECT * INTO v_campanha FROM comissoes_campanhas WHERE id = p_campanha_id;
  IF v_campanha IS NULL THEN RETURN; END IF;

  -- Ler peso dinâmico de troca de titularidade
  v_peso_troca := COALESCE(fn_parametro_comissao('pontos_troca_titularidade')::NUMERIC, 0.5);

  -- Limpar ranking anterior desta campanha
  DELETE FROM comissoes_ranking_mensal WHERE campanha_id = p_campanha_id;

  -- Calcular vendas de cada vendedor (agora incluindo substituições de placa)
  FOR v_vendedor IN
    SELECT DISTINCT c.vendedor_id,
      fn_tipo_consultor(c.vendedor_id) as tipo_consultor,
      fn_tempo_casa_consultor(c.vendedor_id) as categoria_tempo,
      fn_placas_ativas_consultor(c.vendedor_id) as placas_ativas,
      COUNT(*) FILTER (WHERE c.status = 'ativo' AND c.adesao_paga = true) as vendas_confirmadas,
      COUNT(*) FILTER (WHERE c.status = 'cancelado') as vendas_canceladas,
      COUNT(*) FILTER (WHERE c.tipo_venda = 'troca_titularidade' AND c.status = 'ativo') as trocas_titularidade,
      -- Somar pontos de substituição de placa do período
      COALESCE((
        SELECT SUM(sv.pontos_consultor)
        FROM substituicoes_veiculo sv
        WHERE sv.consultor_id = c.vendedor_id
          AND sv.status = 'efetivada'
          AND EXTRACT(MONTH FROM sv.efetivada_em) = v_campanha.mes
          AND EXTRACT(YEAR FROM sv.efetivada_em) = v_campanha.ano
      ), 0) as pontos_substituicao
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
      -- Fórmula corrigida: vendas - cancelamentos + (trocas * peso_dinâmico) + substituições
      v_vendedor.vendas_confirmadas - v_vendedor.vendas_canceladas 
        + (v_vendedor.trocas_titularidade * v_peso_troca) 
        + v_vendedor.pontos_substituicao,
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
        ORDER BY vendas_liquidas DESC, vendedor_id ASC
      LOOP
        v_posicao := v_posicao + 1;
        
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

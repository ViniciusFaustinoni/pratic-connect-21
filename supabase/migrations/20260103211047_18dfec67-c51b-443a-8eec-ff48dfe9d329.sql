-- Política para permitir associados atualizarem (cancelarem) seus próprios chamados
CREATE POLICY "Associates can update own calls" 
ON chamados_assistencia FOR UPDATE
USING (associado_id = get_my_associado_id(auth.uid()))
WITH CHECK (associado_id = get_my_associado_id(auth.uid()));

-- Função de estatísticas de assistência do dia
CREATE OR REPLACE FUNCTION get_estatisticas_assistencia_dia(p_data DATE DEFAULT CURRENT_DATE)
RETURNS JSON AS $$
DECLARE
  resultado JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'abertos', COUNT(*) FILTER (WHERE status = 'aberto'),
    'em_andamento', COUNT(*) FILTER (WHERE status IN ('aguardando_prestador', 'prestador_despachado', 'prestador_a_caminho', 'em_atendimento')),
    'concluidos', COUNT(*) FILTER (WHERE status = 'concluido'),
    'cancelados', COUNT(*) FILTER (WHERE status::text LIKE 'cancelado%'),
    'por_tipo', (
      SELECT COALESCE(json_object_agg(tipo_servico, cnt), '{}'::json)
      FROM (
        SELECT tipo_servico, COUNT(*) as cnt
        FROM chamados_assistencia
        WHERE DATE(data_abertura) = p_data
        GROUP BY tipo_servico
      ) t
    ),
    'tempo_medio_minutos', COALESCE(
      AVG(EXTRACT(EPOCH FROM (data_conclusao - data_abertura)) / 60) FILTER (WHERE status = 'concluido'),
      0
    )::INTEGER
  ) INTO resultado
  FROM chamados_assistencia
  WHERE DATE(data_abertura) = p_data;
  
  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função de estatísticas do prestador
CREATE OR REPLACE FUNCTION get_estatisticas_prestador(p_prestador_id UUID)
RETURNS JSON AS $$
DECLARE
  resultado JSON;
BEGIN
  SELECT json_build_object(
    'total_atendimentos', COUNT(*),
    'atendimentos_concluidos', COUNT(*) FILTER (WHERE status = 'concluido'),
    'atendimentos_recusados', COUNT(*) FILTER (WHERE status = 'recusado'),
    'taxa_aceite', COALESCE(ROUND(
      COUNT(*) FILTER (WHERE status NOT IN ('recusado', 'cancelado'))::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      1
    ), 0),
    'tempo_medio_chegada_minutos', COALESCE(
      AVG(EXTRACT(EPOCH FROM (hora_chegada - hora_acionamento)) / 60) FILTER (WHERE hora_chegada IS NOT NULL),
      0
    )::INTEGER
  ) INTO resultado
  FROM chamados_assistencia_atendimentos
  WHERE prestador_id = p_prestador_id;
  
  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
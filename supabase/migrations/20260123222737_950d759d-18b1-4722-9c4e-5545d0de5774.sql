-- Primeiro dropar a função existente para poder recriar com os mesmos parâmetros
DROP FUNCTION IF EXISTS public.buscar_tarefa_atual_profissional(UUID);

-- Recriar a RPC incluindo status 'agendada' quando data_agendada <= hoje
CREATE OR REPLACE FUNCTION public.buscar_tarefa_atual_profissional(p_profissional_id UUID)
RETURNS TABLE (
  id UUID,
  tipo TEXT,
  status TEXT,
  data_agendada DATE,
  hora_agendada TIME,
  periodo TEXT,
  associado_id UUID,
  associado_nome TEXT,
  associado_telefone TEXT,
  associado_whatsapp TEXT,
  veiculo_id UUID,
  veiculo_placa TEXT,
  veiculo_marca TEXT,
  veiculo_modelo TEXT,
  veiculo_cor TEXT,
  logradouro TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  cotacao_id UUID,
  contrato_id UUID,
  rastreador_id UUID,
  imei_rastreador TEXT,
  local_vistoria TEXT,
  observacoes TEXT,
  rota_id UUID,
  iniciada_em TIMESTAMPTZ,
  em_rota_em TIMESTAMPTZ,
  instalacao_origem_id UUID,
  vistoria_origem_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.tipo::TEXT,
    s.status::TEXT,
    s.data_agendada,
    s.hora_agendada,
    s.periodo::TEXT,
    s.associado_id,
    a.nome AS associado_nome,
    a.telefone AS associado_telefone,
    a.whatsapp AS associado_whatsapp,
    s.veiculo_id,
    v.placa AS veiculo_placa,
    v.marca AS veiculo_marca,
    v.modelo AS veiculo_modelo,
    v.cor AS veiculo_cor,
    s.logradouro,
    s.numero,
    s.bairro,
    s.cidade,
    s.uf,
    s.cep,
    s.latitude,
    s.longitude,
    s.cotacao_id,
    s.contrato_id,
    s.rastreador_id,
    r.imei AS imei_rastreador,
    s.local_vistoria,
    s.observacoes,
    s.rota_id,
    s.iniciada_em,
    s.em_rota_em,
    s.instalacao_origem_id,
    s.vistoria_origem_id
  FROM servicos s 
  LEFT JOIN associados a ON a.id = s.associado_id 
  LEFT JOIN veiculos v ON v.id = s.veiculo_id
  LEFT JOIN rastreadores r ON r.id = s.rastreador_id
  WHERE s.profissional_id = p_profissional_id 
    AND (
      -- Tarefas em andamento ou em rota (prioridade máxima)
      s.status::TEXT IN ('em_rota', 'em_andamento')
      OR 
      -- Tarefas agendadas para hoje ou datas anteriores (pendências atribuídas manualmente)
      (s.status::TEXT = 'agendada' AND s.data_agendada <= CURRENT_DATE)
    )
  ORDER BY 
    CASE s.status::TEXT 
      WHEN 'em_andamento' THEN 0 
      WHEN 'em_rota' THEN 1 
      WHEN 'agendada' THEN 2 
    END,
    s.data_agendada,
    s.hora_agendada NULLS LAST
  LIMIT 1;
END;
$$;
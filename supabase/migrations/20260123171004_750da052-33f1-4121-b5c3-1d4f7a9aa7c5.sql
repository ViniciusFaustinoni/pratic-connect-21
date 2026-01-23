-- Drop e recriar a função para incluir novos campos
DROP FUNCTION IF EXISTS public.buscar_tarefa_atual_profissional(UUID);

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
  latitude DOUBLE PRECISION, 
  longitude DOUBLE PRECISION, 
  rota_id UUID,
  cotacao_id UUID,
  contrato_id UUID,
  rastreador_id UUID,
  imei_rastreador TEXT,
  local_vistoria TEXT,
  observacoes TEXT,
  iniciada_em TIMESTAMPTZ,
  em_rota_em TIMESTAMPTZ,
  instalacao_origem_id UUID,
  vistoria_origem_id UUID
) AS $$
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
    a.nome, 
    a.telefone,
    a.whatsapp,
    s.veiculo_id, 
    v.placa, 
    v.marca, 
    v.modelo,
    v.cor,
    s.logradouro, 
    s.numero, 
    s.bairro, 
    s.cidade, 
    s.uf,
    s.cep,
    s.latitude::DOUBLE PRECISION, 
    s.longitude::DOUBLE PRECISION, 
    s.rota_id,
    s.cotacao_id,
    s.contrato_id,
    s.rastreador_id,
    s.imei_rastreador,
    s.local_vistoria,
    s.observacoes,
    s.iniciada_em,
    s.em_rota_em,
    s.instalacao_origem_id,
    s.vistoria_origem_id
  FROM servicos s 
  LEFT JOIN associados a ON a.id = s.associado_id 
  LEFT JOIN veiculos v ON v.id = s.veiculo_id
  WHERE s.profissional_id = p_profissional_id 
    AND s.status::TEXT IN ('em_rota', 'em_andamento')
  ORDER BY 
    CASE WHEN s.status::TEXT = 'em_andamento' THEN 0 ELSE 1 END,
    s.data_agendada,
    s.hora_agendada
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
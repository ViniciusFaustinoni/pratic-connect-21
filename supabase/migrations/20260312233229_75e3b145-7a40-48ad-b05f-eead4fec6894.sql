DROP FUNCTION IF EXISTS buscar_tarefa_atual_profissional(UUID);

CREATE FUNCTION buscar_tarefa_atual_profissional(p_profissional_id UUID)
RETURNS TABLE(
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
  placa TEXT,
  marca TEXT,
  modelo TEXT,
  cor TEXT,
  logradouro TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
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
  vistoria_origem_id UUID,
  confirmacao_whatsapp TEXT,
  confirmado_via_whatsapp_em TIMESTAMPTZ,
  permite_encaixe BOOLEAN,
  contato_realizado_em TIMESTAMPTZ,
  contato_tipo TEXT,
  etapa_atual INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
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
    COALESCE(a.nome, c.nome_solicitante)::TEXT AS associado_nome,
    COALESCE(a.telefone, c.telefone1_solicitante)::TEXT AS associado_telefone,
    a.whatsapp::TEXT AS associado_whatsapp,
    s.veiculo_id,
    v.placa::TEXT,
    v.marca::TEXT,
    v.modelo::TEXT,
    v.cor::TEXT,
    s.logradouro::TEXT,
    s.numero::TEXT,
    s.bairro::TEXT,
    s.cidade::TEXT,
    s.uf::TEXT,
    s.cep::TEXT,
    s.latitude,
    s.longitude,
    s.cotacao_id,
    s.contrato_id,
    s.rastreador_id,
    r.imei::TEXT AS imei_rastreador,
    s.local_vistoria::TEXT,
    s.observacoes::TEXT,
    s.rota_id,
    s.iniciada_em,
    s.em_rota_em,
    s.instalacao_origem_id,
    s.vistoria_origem_id,
    s.confirmacao_whatsapp::TEXT,
    s.confirmado_via_whatsapp_em,
    COALESCE(s.permite_encaixe, false)::boolean AS permite_encaixe,
    s.contato_realizado_em,
    s.contato_tipo::TEXT,
    COALESCE(s.etapa_atual, 1)::integer AS etapa_atual
  FROM servicos s
  LEFT JOIN associados a ON s.associado_id = a.id
  LEFT JOIN cotacoes c ON s.cotacao_id = c.id
  LEFT JOIN veiculos v ON s.veiculo_id = v.id
  LEFT JOIN rastreadores r ON s.rastreador_id = r.id
  WHERE s.profissional_id = p_profissional_id
    AND s.status IN ('em_rota', 'em_andamento', 'agendada', 'em_analise')
    AND s.imprevisto_registrado_em IS NULL
  ORDER BY 
    CASE s.status 
      WHEN 'em_andamento' THEN 1
      WHEN 'em_analise' THEN 2
      WHEN 'em_rota' THEN 3
      WHEN 'agendada' THEN 4
    END,
    s.data_agendada ASC,
    s.hora_agendada ASC NULLS LAST
  LIMIT 1;
END;
$$;
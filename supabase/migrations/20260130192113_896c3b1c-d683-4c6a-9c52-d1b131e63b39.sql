-- Corrigir RPC buscar_tarefa_atual_profissional: c.nome -> c.nome_solicitante, c.telefone -> c.telefone_solicitante
CREATE OR REPLACE FUNCTION public.buscar_tarefa_atual_profissional(p_profissional_id uuid)
 RETURNS TABLE(id uuid, tipo text, status text, data_agendada date, hora_agendada time without time zone, periodo text, associado_id uuid, associado_nome text, associado_telefone text, associado_whatsapp text, veiculo_id uuid, veiculo_placa text, veiculo_marca text, veiculo_modelo text, veiculo_cor text, logradouro text, numero text, bairro text, cidade text, uf text, cep text, latitude numeric, longitude numeric, cotacao_id uuid, contrato_id uuid, rastreador_id uuid, imei_rastreador text, local_vistoria text, observacoes text, rota_id uuid, iniciada_em timestamp with time zone, em_rota_em timestamp with time zone, instalacao_origem_id uuid, vistoria_origem_id uuid, confirmacao_whatsapp text, confirmado_via_whatsapp_em timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    COALESCE(a.telefone, c.telefone_solicitante)::TEXT AS associado_telefone,
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
    s.confirmado_via_whatsapp_em
  FROM servicos s
  LEFT JOIN associados a ON s.associado_id = a.id
  LEFT JOIN cotacoes c ON s.cotacao_id = c.id
  LEFT JOIN veiculos v ON s.veiculo_id = v.id
  LEFT JOIN rastreadores r ON s.rastreador_id = r.id
  WHERE s.profissional_id = p_profissional_id
    AND s.status IN ('em_rota', 'em_andamento', 'agendada')
  ORDER BY 
    CASE s.status 
      WHEN 'em_andamento' THEN 1
      WHEN 'em_rota' THEN 2
      WHEN 'agendada' THEN 3
    END,
    s.data_agendada ASC,
    s.hora_agendada ASC NULLS LAST
  LIMIT 1;
END;
$function$;
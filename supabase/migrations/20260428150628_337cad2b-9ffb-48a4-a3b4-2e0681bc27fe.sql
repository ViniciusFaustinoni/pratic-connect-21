CREATE OR REPLACE FUNCTION public.buscar_tarefa_atual_profissional(p_profissional_id uuid)
 RETURNS TABLE(id uuid, tipo text, status text, data_agendada date, hora_agendada time without time zone, periodo text, associado_id uuid, associado_nome text, associado_telefone text, associado_whatsapp text, veiculo_id uuid, placa text, marca text, modelo text, cor text, logradouro text, numero text, bairro text, cidade text, uf text, cep text, latitude numeric, longitude numeric, cotacao_id uuid, contrato_id uuid, rastreador_id uuid, imei_rastreador text, local_vistoria text, observacoes text, rota_id uuid, iniciada_em timestamp with time zone, em_rota_em timestamp with time zone, instalacao_origem_id uuid, vistoria_origem_id uuid, confirmacao_whatsapp text, confirmado_via_whatsapp_em timestamp with time zone, permite_encaixe boolean, contato_realizado_em timestamp with time zone, contato_tipo text, etapa_atual integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ranked.id, ranked.tipo, ranked.status, ranked.data_agendada, ranked.hora_agendada,
    ranked.periodo, ranked.associado_id, ranked.associado_nome, ranked.associado_telefone, ranked.associado_whatsapp,
    ranked.veiculo_id, ranked.placa, ranked.marca, ranked.modelo, ranked.cor,
    ranked.logradouro, ranked.numero, ranked.bairro, ranked.cidade, ranked.uf, ranked.cep,
    ranked.latitude, ranked.longitude, ranked.cotacao_id, ranked.contrato_id,
    ranked.rastreador_id, ranked.imei_rastreador, ranked.local_vistoria, ranked.observacoes,
    ranked.rota_id, ranked.iniciada_em, ranked.em_rota_em,
    ranked.instalacao_origem_id, ranked.vistoria_origem_id,
    ranked.confirmacao_whatsapp, ranked.confirmado_via_whatsapp_em,
    ranked.permite_encaixe, ranked.contato_realizado_em, ranked.contato_tipo,
    ranked.etapa_atual
  FROM (
    SELECT 
      s.id,
      s.tipo::TEXT AS tipo,
      s.status::TEXT AS status,
      s.data_agendada,
      s.hora_agendada,
      s.periodo::TEXT AS periodo,
      s.associado_id,
      COALESCE(a.nome, c.nome_solicitante)::TEXT AS associado_nome,
      COALESCE(a.telefone, c.telefone1_solicitante)::TEXT AS associado_telefone,
      a.whatsapp::TEXT AS associado_whatsapp,
      s.veiculo_id,
      v.placa::TEXT AS placa,
      v.marca::TEXT AS marca,
      v.modelo::TEXT AS modelo,
      v.cor::TEXT AS cor,
      s.logradouro::TEXT, s.numero::TEXT, s.bairro::TEXT, s.cidade::TEXT, s.uf::TEXT, s.cep::TEXT,
      s.latitude, s.longitude,
      s.cotacao_id, s.contrato_id, s.rastreador_id,
      r.imei::TEXT AS imei_rastreador,
      s.local_vistoria::TEXT, s.observacoes::TEXT,
      s.rota_id, s.iniciada_em, s.em_rota_em,
      s.instalacao_origem_id, s.vistoria_origem_id,
      s.confirmacao_whatsapp::TEXT,
      s.confirmado_via_whatsapp_em,
      COALESCE(s.permite_encaixe, false)::boolean AS permite_encaixe,
      s.contato_realizado_em,
      s.contato_tipo::TEXT,
      COALESCE(s.etapa_atual, 1)::integer AS etapa_atual,
      CASE s.status::text
        WHEN 'em_andamento' THEN 1
        WHEN 'em_rota'      THEN 3
        WHEN 'agendada'     THEN 5
        ELSE 9
      END AS sort_status,
      0::int AS sort_source
    FROM servicos s
    LEFT JOIN associados a ON s.associado_id = a.id
    LEFT JOIN cotacoes   c ON s.cotacao_id   = c.id
    LEFT JOIN veiculos   v ON s.veiculo_id   = v.id
    LEFT JOIN rastreadores r ON s.rastreador_id = r.id
    WHERE s.profissional_id = p_profissional_id
      AND s.status IN ('em_rota','em_andamento','agendada')
      AND s.imprevisto_registrado_em IS NULL
      AND NOT (
        s.tipo = 'vistoria_entrada'
        AND s.iniciada_em IS NULL
        AND s.associado_id IS NOT NULL
        AND s.veiculo_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM servicos s2
           WHERE s2.tipo = 'instalacao'
             AND s2.associado_id = s.associado_id
             AND s2.veiculo_id   = s.veiculo_id
             AND s2.id <> s.id
             AND s2.status::text IN ('agendada','em_rota','em_andamento','em_analise','concluida','aprovada','aprovada_ressalvas','nao_compareceu','reagendada')
        )
      )

    UNION ALL

    SELECT
      ab.id,
      'vistoria_base'::TEXT,
      ab.status::TEXT,
      ab.data_agendada,
      ab.horario::time,
      NULL::TEXT,
      NULL::uuid,
      NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::uuid,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::numeric, NULL::numeric,
      NULL::uuid, NULL::uuid, NULL::uuid,
      NULL::TEXT,
      NULL::TEXT, ab.observacoes::TEXT,
      NULL::uuid, NULL::timestamptz, NULL::timestamptz,
      NULL::uuid, NULL::uuid,
      NULL::TEXT, NULL::timestamptz,
      false::boolean,
      NULL::timestamptz, NULL::TEXT,
      1::integer,
      CASE ab.status::text
        WHEN 'em_andamento' THEN 1
        WHEN 'em_rota'      THEN 3
        WHEN 'agendada'     THEN 5
        ELSE 9
      END AS sort_status,
      1::int AS sort_source
    FROM agendamentos_base ab
    WHERE ab.atendido_por = p_profissional_id
      AND ab.status::text IN ('em_rota','em_andamento','agendada')
  ) ranked
  ORDER BY sort_status ASC, sort_source ASC, data_agendada ASC NULLS LAST, hora_agendada ASC NULLS LAST
  LIMIT 1;
END;
$function$;
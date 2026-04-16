-- Corrigir RPC buscar_tarefa_atual_profissional:
-- 1) Remove ambiguidade de "status" no ORDER BY (qualifica via subquery)
-- 2) Sempre prioriza o registro de servicos materializado
-- 3) Só inclui agendamentos_base se NÃO houver servico materializado vinculado
--    (evita devolver registro cru de base quando o tecnico precisa do servico.id)

DROP FUNCTION IF EXISTS public.buscar_tarefa_atual_profissional(uuid);

CREATE OR REPLACE FUNCTION public.buscar_tarefa_atual_profissional(p_profissional_id uuid)
 RETURNS TABLE(
   id uuid, tipo text, status text, data_agendada date, hora_agendada time without time zone,
   periodo text, associado_id uuid, associado_nome text, associado_telefone text, associado_whatsapp text,
   veiculo_id uuid, placa text, marca text, modelo text, cor text,
   logradouro text, numero text, bairro text, cidade text, uf text, cep text,
   latitude numeric, longitude numeric, cotacao_id uuid, contrato_id uuid,
   rastreador_id uuid, imei_rastreador text, local_vistoria text, observacoes text,
   rota_id uuid, iniciada_em timestamp with time zone, em_rota_em timestamp with time zone,
   instalacao_origem_id uuid, vistoria_origem_id uuid,
   confirmacao_whatsapp text, confirmado_via_whatsapp_em timestamp with time zone,
   permite_encaixe boolean, contato_realizado_em timestamp with time zone, contato_tipo text,
   etapa_atual integer
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    -- ================================
    -- 1) Serviços materializados (PRIORIDADE)
    -- ================================
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
      s.logradouro::TEXT AS logradouro,
      s.numero::TEXT AS numero,
      s.bairro::TEXT AS bairro,
      s.cidade::TEXT AS cidade,
      s.uf::TEXT AS uf,
      s.cep::TEXT AS cep,
      s.latitude,
      s.longitude,
      s.cotacao_id,
      s.contrato_id,
      s.rastreador_id,
      r.imei::TEXT AS imei_rastreador,
      s.local_vistoria::TEXT AS local_vistoria,
      s.observacoes::TEXT AS observacoes,
      s.rota_id,
      s.iniciada_em,
      s.em_rota_em,
      s.instalacao_origem_id,
      s.vistoria_origem_id,
      s.confirmacao_whatsapp::TEXT AS confirmacao_whatsapp,
      s.confirmado_via_whatsapp_em,
      COALESCE(s.permite_encaixe, false)::boolean AS permite_encaixe,
      s.contato_realizado_em,
      s.contato_tipo::TEXT AS contato_tipo,
      COALESCE(s.etapa_atual, 1)::integer AS etapa_atual,
      -- coluna auxiliar p/ ordenação (NÃO está no RETURNS)
      CASE s.status::text
        WHEN 'em_andamento' THEN 1
        WHEN 'em_analise'   THEN 2
        WHEN 'em_rota'      THEN 3
        WHEN 'agendada'     THEN 5
        ELSE 9
      END AS sort_status,
      0::int AS sort_source  -- serviços têm prioridade sobre base crua
    FROM servicos s
    LEFT JOIN associados a ON s.associado_id = a.id
    LEFT JOIN cotacoes   c ON s.cotacao_id   = c.id
    LEFT JOIN veiculos   v ON s.veiculo_id   = v.id
    LEFT JOIN rastreadores r ON s.rastreador_id = r.id
    WHERE s.profissional_id = p_profissional_id
      AND s.status IN ('em_rota','em_andamento','agendada','em_analise')
      AND s.imprevisto_registrado_em IS NULL

    UNION ALL

    -- ================================
    -- 2) Vistorias de BASE ainda NÃO materializadas em servicos
    --    (fallback — só aparece se não houver servico vinculado)
    -- ================================
    SELECT
      ab.id,
      'vistoria_base'::TEXT AS tipo,
      ab.status::TEXT AS status,
      ab.data_agendada,
      ab.horario::time AS hora_agendada,
      NULL::TEXT AS periodo,
      NULL::uuid AS associado_id,
      ab.cliente_nome::TEXT AS associado_nome,
      ab.cliente_telefone::TEXT AS associado_telefone,
      NULL::TEXT AS associado_whatsapp,
      NULL::uuid AS veiculo_id,
      ab.veiculo_placa::TEXT AS placa,
      NULL::TEXT AS marca,
      NULL::TEXT AS modelo,
      NULL::TEXT AS cor,
      NULL::TEXT AS logradouro,
      NULL::TEXT AS numero,
      NULL::TEXT AS bairro,
      NULL::TEXT AS cidade,
      NULL::TEXT AS uf,
      NULL::TEXT AS cep,
      NULL::numeric AS latitude,
      NULL::numeric AS longitude,
      ab.cotacao_id,
      NULL::uuid AS contrato_id,
      NULL::uuid AS rastreador_id,
      NULL::TEXT AS imei_rastreador,
      'base'::TEXT AS local_vistoria,
      ab.observacoes::TEXT AS observacoes,
      NULL::uuid AS rota_id,
      NULL::timestamptz AS iniciada_em,
      NULL::timestamptz AS em_rota_em,
      NULL::uuid AS instalacao_origem_id,
      ab.vistoria_id AS vistoria_origem_id,
      NULL::TEXT AS confirmacao_whatsapp,
      NULL::timestamptz AS confirmado_via_whatsapp_em,
      false::boolean AS permite_encaixe,
      NULL::timestamptz AS contato_realizado_em,
      NULL::TEXT AS contato_tipo,
      1::integer AS etapa_atual,
      CASE ab.status::text
        WHEN 'em_andamento' THEN 1
        WHEN 'confirmado'   THEN 4
        WHEN 'agendado'     THEN 5
        ELSE 9
      END AS sort_status,
      1::int AS sort_source  -- base crua só se não houver servico
    FROM agendamentos_base ab
    WHERE ab.atendido_por = p_profissional_id
      AND ab.status IN ('confirmado','em_andamento','agendado')
      AND ab.data_agendada = CURRENT_DATE
      -- Só retorna se não existir servico materializado vinculado
      -- (evita duplicidade e garante que a leitura privilegie servicos)
      AND NOT EXISTS (
        SELECT 1
        FROM servicos s2
        WHERE s2.profissional_id = p_profissional_id
          AND s2.status IN ('em_rota','em_andamento','agendada','em_analise')
          AND (
            s2.vistoria_origem_id = ab.vistoria_id
            OR (s2.veiculo_id IS NULL AND s2.cotacao_id = ab.cotacao_id)
          )
      )
  ) ranked
  ORDER BY ranked.sort_source ASC, ranked.sort_status ASC,
           ranked.data_agendada ASC, ranked.hora_agendada ASC NULLS LAST
  LIMIT 1;
END;
$function$;
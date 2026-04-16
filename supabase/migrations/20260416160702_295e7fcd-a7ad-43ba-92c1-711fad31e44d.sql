
-- 1. Add agendamento_base_id column and make servico_id nullable
ALTER TABLE public.servicos_atribuicoes_log
  ALTER COLUMN servico_id DROP NOT NULL;

ALTER TABLE public.servicos_atribuicoes_log
  ADD COLUMN agendamento_base_id uuid REFERENCES public.agendamentos_base(id) ON DELETE CASCADE;

-- Add CHECK constraint: at least one must be set
ALTER TABLE public.servicos_atribuicoes_log
  ADD CONSTRAINT chk_servico_or_base CHECK (servico_id IS NOT NULL OR agendamento_base_id IS NOT NULL);

CREATE INDEX idx_atribuicoes_log_base ON public.servicos_atribuicoes_log(agendamento_base_id) WHERE agendamento_base_id IS NOT NULL;

-- 2. Update RPC to include agendamentos_base
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
AS $function$
BEGIN
  RETURN QUERY
  (
    -- Regular services
    SELECT 
      s.id, s.tipo::TEXT, s.status::TEXT, s.data_agendada, s.hora_agendada, s.periodo::TEXT,
      s.associado_id,
      COALESCE(a.nome, c.nome_solicitante)::TEXT AS associado_nome,
      COALESCE(a.telefone, c.telefone1_solicitante)::TEXT AS associado_telefone,
      a.whatsapp::TEXT AS associado_whatsapp,
      s.veiculo_id, v.placa::TEXT, v.marca::TEXT, v.modelo::TEXT, v.cor::TEXT,
      s.logradouro::TEXT, s.numero::TEXT, s.bairro::TEXT, s.cidade::TEXT, s.uf::TEXT, s.cep::TEXT,
      s.latitude, s.longitude,
      s.cotacao_id, s.contrato_id, s.rastreador_id, r.imei::TEXT AS imei_rastreador,
      s.local_vistoria::TEXT, s.observacoes::TEXT, s.rota_id, s.iniciada_em, s.em_rota_em,
      s.instalacao_origem_id, s.vistoria_origem_id,
      s.confirmacao_whatsapp::TEXT, s.confirmado_via_whatsapp_em,
      COALESCE(s.permite_encaixe, false)::boolean AS permite_encaixe,
      s.contato_realizado_em, s.contato_tipo::TEXT,
      COALESCE(s.etapa_atual, 1)::integer AS etapa_atual
    FROM servicos s
    LEFT JOIN associados a ON s.associado_id = a.id
    LEFT JOIN cotacoes c ON s.cotacao_id = c.id
    LEFT JOIN veiculos v ON s.veiculo_id = v.id
    LEFT JOIN rastreadores r ON s.rastreador_id = r.id
    WHERE s.profissional_id = p_profissional_id
      AND s.status IN ('em_rota', 'em_andamento', 'agendada', 'em_analise')
      AND s.imprevisto_registrado_em IS NULL

    UNION ALL

    -- Base inspections
    SELECT
      ab.id,
      'vistoria_base'::TEXT AS tipo,
      ab.status::TEXT,
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
      ab.observacoes::TEXT,
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
      1::integer AS etapa_atual
    FROM agendamentos_base ab
    WHERE ab.atendido_por = p_profissional_id
      AND ab.status IN ('confirmado', 'em_andamento')
      AND ab.data_agendada = CURRENT_DATE
  )
  ORDER BY 
    CASE status WHEN 'em_andamento' THEN 1 WHEN 'em_analise' THEN 2 WHEN 'em_rota' THEN 3 WHEN 'confirmado' THEN 4 WHEN 'agendada' THEN 5 END,
    data_agendada ASC, hora_agendada ASC NULLS LAST
  LIMIT 1;
END;
$function$;

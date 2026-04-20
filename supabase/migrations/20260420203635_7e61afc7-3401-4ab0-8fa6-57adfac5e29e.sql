-- =========================================================
-- FIX RAIZ: vistoria_entrada órfã travando "Tarefa Atual"
-- =========================================================

-- ---------------------------------------------------------
-- 1) Trigger da INSTALAÇÃO: cancela vistoria_entrada órfã
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_vistoria_entrada_orfa_servico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'instalacao'
     AND NEW.associado_id IS NOT NULL
     AND NEW.veiculo_id IS NOT NULL THEN
    UPDATE public.servicos
       SET status = 'cancelada'::status_servico,
           observacoes = COALESCE(observacoes,'') ||
             E'\n[auto] Vistoria de entrada cancelada — substituída pela instalação ' || NEW.id::text || ' em ' || to_char(now(),'DD/MM/YYYY HH24:MI') || '.',
           updated_at = now()
     WHERE tipo = 'vistoria_entrada'
       AND associado_id = NEW.associado_id
       AND veiculo_id   = NEW.veiculo_id
       AND status::text IN ('agendada','em_analise','em_rota')
       AND iniciada_em IS NULL
       AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancelar_vistoria_entrada_orfa_servico ON public.servicos;
CREATE TRIGGER trg_cancelar_vistoria_entrada_orfa_servico
AFTER INSERT OR UPDATE OF associado_id, veiculo_id, tipo
ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.cancelar_vistoria_entrada_orfa_servico();

-- ---------------------------------------------------------
-- 2) Trigger sync_vistoria_to_servicos: blindagem
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_vistoria_to_servicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo tipo_servico;
  v_hora time;
  v_periodo periodo_servico;
  v_data date;
  v_existing_id uuid;
  v_active_servico_id uuid;
  v_has_instalacao boolean := false;
BEGIN
  v_tipo := CASE NEW.tipo::text
    WHEN 'entrada'  THEN 'vistoria_entrada'::tipo_servico
    WHEN 'saida'    THEN 'vistoria_saida'::tipo_servico
    WHEN 'sinistro' THEN 'vistoria_sinistro'::tipo_servico
    ELSE 'vistoria_entrada'::tipo_servico
  END;

  BEGIN
    v_hora := COALESCE(NEW.horario_agendado::time, '09:00:00'::time);
  EXCEPTION WHEN others THEN
    v_hora := '09:00:00'::time;
  END;

  v_periodo := CASE
    WHEN v_hora < '12:00:00'::time THEN 'manha'::periodo_servico
    WHEN v_hora < '18:00:00'::time THEN 'tarde'::periodo_servico
    ELSE 'noite'::periodo_servico
  END;

  v_data := COALESCE(NEW.data_agendada::date, CURRENT_DATE);

  IF TG_OP = 'INSERT' THEN
    -- Idempotência
    SELECT id INTO v_existing_id
      FROM public.servicos
     WHERE vistoria_origem_id = NEW.id
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.servicos
         SET profissional_id = COALESCE(NEW.vistoriador_id, profissional_id),
             updated_at = now()
       WHERE id = v_existing_id;
      RETURN NEW;
    END IF;

    -- BLINDAGEM: se já existe instalação para o mesmo veículo/associado, NÃO cria vistoria nova
    IF v_tipo = 'vistoria_entrada' AND NEW.associado_id IS NOT NULL AND NEW.veiculo_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.servicos
         WHERE tipo = 'instalacao'
           AND associado_id = NEW.associado_id
           AND veiculo_id   = NEW.veiculo_id
           AND status::text IN ('agendada','em_rota','em_andamento','em_analise','concluida','aprovada','aprovada_ressalvas','nao_compareceu','reagendada')
      ) INTO v_has_instalacao;

      IF v_has_instalacao THEN
        RAISE NOTICE '[sync_vistoria] Ignorando criação: já existe instalação para associado=% veiculo=%', NEW.associado_id, NEW.veiculo_id;
        RETURN NEW;
      END IF;
    END IF;

    -- Vincula serviço ATIVO existente se houver
    SELECT id INTO v_active_servico_id
      FROM public.servicos
     WHERE associado_id = NEW.associado_id
       AND veiculo_id   = NEW.veiculo_id
       AND COALESCE(contrato_id::text, '') = COALESCE(NEW.contrato_id::text, '')
       AND status IN ('agendada','em_rota','em_andamento','em_analise')
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_active_servico_id IS NOT NULL THEN
      UPDATE public.servicos
         SET vistoria_origem_id = NEW.id,
             updated_at = now()
       WHERE id = v_active_servico_id;
      RETURN NEW;
    END IF;

    INSERT INTO public.servicos (
      tipo, status, data_agendada, hora_agendada, periodo,
      profissional_id, associado_id, veiculo_id, vistoria_origem_id,
      cep, logradouro, numero, bairro, cidade, rota_id,
      created_at, updated_at
    ) VALUES (
      v_tipo,
      COALESCE(NEW.status::text::status_servico, 'agendada'::status_servico),
      v_data, v_hora, v_periodo,
      NEW.vistoriador_id, NEW.associado_id, NEW.veiculo_id, NEW.id,
      NEW.endereco_cep, NEW.endereco_logradouro, NEW.endereco_numero,
      NEW.endereco_bairro, NEW.endereco_cidade, NEW.rota_id,
      now(), now()
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.servicos SET
      status = COALESCE(NEW.status::text::status_servico, status),
      data_agendada = v_data,
      hora_agendada = v_hora,
      periodo = v_periodo,
      profissional_id = COALESCE(NEW.vistoriador_id, profissional_id),
      associado_id = NEW.associado_id,
      veiculo_id = NEW.veiculo_id,
      cep = NEW.endereco_cep,
      logradouro = NEW.endereco_logradouro,
      numero = NEW.endereco_numero,
      bairro = NEW.endereco_bairro,
      cidade = NEW.endereco_cidade,
      rota_id = NEW.rota_id,
      updated_at = now()
    WHERE vistoria_origem_id = NEW.id;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------
-- 3) RPC buscar_tarefa_atual_profissional: filtro de órfãos
-- ---------------------------------------------------------
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
        WHEN 'em_analise'   THEN 2
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
      AND s.status IN ('em_rota','em_andamento','agendada','em_analise')
      AND s.imprevisto_registrado_em IS NULL
      -- BLINDAGEM: ignora vistoria_entrada órfã substituída por instalação
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
      NULL::TEXT, NULL::uuid,
      ab.cliente_nome::TEXT, ab.cliente_telefone::TEXT, NULL::TEXT,
      NULL::uuid, ab.veiculo_placa::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::numeric, NULL::numeric,
      ab.cotacao_id, NULL::uuid, NULL::uuid, NULL::TEXT,
      'base'::TEXT, ab.observacoes::TEXT,
      NULL::uuid, NULL::timestamptz, NULL::timestamptz,
      NULL::uuid, ab.vistoria_id,
      NULL::TEXT, NULL::timestamptz,
      false::boolean, NULL::timestamptz, NULL::TEXT,
      1::integer,
      CASE ab.status::text
        WHEN 'em_andamento' THEN 1
        WHEN 'confirmado'   THEN 4
        WHEN 'agendado'     THEN 5
        ELSE 9
      END AS sort_status,
      1::int AS sort_source
    FROM agendamentos_base ab
    WHERE ab.atendido_por = p_profissional_id
      AND ab.status IN ('confirmado','em_andamento','agendado')
      AND ab.data_agendada = CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM servicos s2
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

-- ---------------------------------------------------------
-- 4) BACKFILL: cancela vistorias órfãs já existentes
-- ---------------------------------------------------------
UPDATE public.servicos s
   SET status = 'cancelada'::status_servico,
       observacoes = COALESCE(s.observacoes,'') ||
         E'\n[backfill 2026-04-20] Vistoria de entrada órfã cancelada — instalação posterior já existente.',
       updated_at = now()
 WHERE s.tipo = 'vistoria_entrada'
   AND s.iniciada_em IS NULL
   AND s.status::text IN ('agendada','em_analise','em_rota')
   AND s.associado_id IS NOT NULL
   AND s.veiculo_id IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM public.servicos s2
      WHERE s2.tipo = 'instalacao'
        AND s2.associado_id = s.associado_id
        AND s2.veiculo_id   = s.veiculo_id
        AND s2.id <> s.id
        AND s2.status::text IN ('agendada','em_rota','em_andamento','em_analise','concluida','aprovada','aprovada_ressalvas','nao_compareceu','reagendada')
   );

-- ---------------------------------------------------------
-- 5) View v_tarefas_orfas (auditoria)
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW public.v_tarefas_orfas AS
SELECT
  s.id            AS servico_vistoria_id,
  s.associado_id,
  s.veiculo_id,
  v.placa,
  s.data_agendada AS data_agendada_vistoria,
  s.hora_agendada,
  s.status::text  AS status_vistoria,
  s.profissional_id,
  inst.id         AS servico_instalacao_relacionado,
  inst.status::text AS status_instalacao,
  inst.data_agendada AS data_agendada_instalacao,
  CASE
    WHEN inst.id IS NOT NULL THEN 'instalacao_posterior_existente'
    ELSE 'sem_instalacao_porem_aberta_ha_muito'
  END AS motivo_orfandade
FROM public.servicos s
LEFT JOIN public.veiculos v ON v.id = s.veiculo_id
LEFT JOIN LATERAL (
  SELECT s2.id, s2.status, s2.data_agendada
    FROM public.servicos s2
   WHERE s2.tipo = 'instalacao'
     AND s2.associado_id = s.associado_id
     AND s2.veiculo_id   = s.veiculo_id
     AND s2.id <> s.id
   ORDER BY s2.created_at DESC
   LIMIT 1
) inst ON TRUE
WHERE s.tipo = 'vistoria_entrada'
  AND s.iniciada_em IS NULL
  AND s.status::text IN ('agendada','em_analise','em_rota')
  AND (
    inst.id IS NOT NULL
    OR s.created_at < now() - interval '24 hours'
  );

GRANT SELECT ON public.v_tarefas_orfas TO authenticated;
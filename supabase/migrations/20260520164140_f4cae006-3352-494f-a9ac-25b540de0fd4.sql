-- =============================================================================
-- Fix: serviços presenciais contaminados por vistoria_origem_id de autovistoria
-- Caso KRF8B74 + 4 outros — bloqueava realocação por guard
-- fn_guard_autovistoria_servico_disjunto.
-- =============================================================================

-- (1) Higienização: remove vínculo indevido com autovistoria em serviços
-- presenciais (que têm instalacao_origem_id). Autovistoria continua existindo
-- como artefato terminal separado.
WITH alvos AS (
  SELECT s.id, s.vistoria_origem_id, s.observacoes
  FROM public.servicos s
  JOIN public.vistorias v ON v.id = s.vistoria_origem_id
  WHERE v.modalidade = 'autovistoria'
    AND s.instalacao_origem_id IS NOT NULL
)
UPDATE public.servicos s
SET vistoria_origem_id = NULL,
    observacoes = COALESCE(NULLIF(a.observacoes,''), '') ||
      CASE WHEN COALESCE(a.observacoes,'') = '' THEN '' ELSE E'\n' END ||
      '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
      '] SANEAMENTO: removido vistoria_origem_id=' || a.vistoria_origem_id::text ||
      ' (autovistoria) - servico presencial nao pode herdar vinculo de autovistoria.',
    updated_at = now()
FROM alvos a
WHERE s.id = a.id;

-- (2) Causa raiz: re-cria fn_sync_vistoria_to_servico bloqueando autovistoria
-- de anexar a servico presencial existente.
CREATE OR REPLACE FUNCTION public.fn_sync_vistoria_to_servico()
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
  v_is_autovistoria boolean := false;
BEGIN
  v_is_autovistoria := COALESCE(NEW.modalidade, '') = 'autovistoria';

  v_tipo := COALESCE(
    public.map_vistoria_tipo_to_servico(NEW.tipo::text),
    'vistoria_entrada'::tipo_servico
  );

  v_hora := COALESCE(NEW.horario_agendado, '09:00:00'::time);

  v_periodo := CASE
    WHEN v_hora < '12:00:00'::time THEN 'manha'::periodo_servico
    WHEN v_hora < '18:00:00'::time THEN 'tarde'::periodo_servico
    ELSE 'noite'::periodo_servico
  END;

  v_data := COALESCE(NEW.data_agendada::date, CURRENT_DATE);

  IF TG_OP = 'INSERT' THEN
    SELECT id INTO v_existing_id FROM public.servicos WHERE vistoria_origem_id = NEW.id LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      UPDATE public.servicos
         SET profissional_id = COALESCE(profissional_id, NEW.vistoriador_id),
             updated_at = now()
       WHERE id = v_existing_id;
      RETURN NEW;
    END IF;

    IF NOT v_is_autovistoria
       AND v_tipo = 'vistoria_entrada'
       AND NEW.associado_id IS NOT NULL AND NEW.veiculo_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.servicos
         WHERE tipo = 'instalacao'
           AND associado_id = NEW.associado_id
           AND veiculo_id   = NEW.veiculo_id
           AND status::text IN ('agendada','em_rota','em_andamento','em_analise','concluida','aprovada','aprovada_ressalvas','nao_compareceu','reagendada')
      ) INTO v_has_instalacao;
      IF v_has_instalacao THEN
        RETURN NEW;
      END IF;
    END IF;

    -- Reuso de servico ativo: APENAS para vistorias presenciais.
    -- Autovistoria NUNCA pode anexar a servico presencial existente.
    IF NOT v_is_autovistoria THEN
      SELECT id INTO v_active_servico_id
        FROM public.servicos
       WHERE associado_id = NEW.associado_id
         AND veiculo_id   = NEW.veiculo_id
         AND COALESCE(contrato_id::text, '') = COALESCE(NEW.contrato_id::text, '')
         AND status IN ('agendada','em_rota','em_andamento','em_analise')
         AND COALESCE(modalidade::text, 'presencial') <> 'autovistoria'
       ORDER BY created_at DESC LIMIT 1;

      IF v_active_servico_id IS NOT NULL THEN
        UPDATE public.servicos
           SET vistoria_origem_id = NEW.id,
               updated_at = now()
         WHERE id = v_active_servico_id;
        RETURN NEW;
      END IF;
    END IF;

    INSERT INTO public.servicos (
      tipo, status, data_agendada, hora_agendada, periodo,
      profissional_id, associado_id, veiculo_id, vistoria_origem_id,
      cep, logradouro, numero, bairro, cidade, rota_id,
      modalidade,
      created_at, updated_at
    ) VALUES (
      v_tipo,
      COALESCE(NEW.status::text::status_servico, 'agendada'::status_servico),
      v_data, v_hora, v_periodo,
      NEW.vistoriador_id, NEW.associado_id, NEW.veiculo_id, NEW.id,
      NEW.endereco_cep, NEW.endereco_logradouro, NEW.endereco_numero,
      NEW.endereco_bairro, NEW.endereco_cidade, NEW.rota_id,
      CASE WHEN v_is_autovistoria THEN 'autovistoria' ELSE 'presencial' END,
      NOW(), NOW()
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.servicos
       SET data_agendada = v_data,
           hora_agendada = v_hora,
           periodo       = v_periodo,
           profissional_id = COALESCE(NEW.vistoriador_id, profissional_id),
           rota_id       = COALESCE(NEW.rota_id, rota_id),
           updated_at = now()
     WHERE vistoria_origem_id = NEW.id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.fn_sync_vistoria_to_servico() IS
'Sincroniza vistorias->servicos. Guard: autovistoria nunca anexa a servico presencial existente (caso KRF8B74).';
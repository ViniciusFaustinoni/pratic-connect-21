-- Corrige enum tipo_vistoria: usar 'entrada' (tipo válido para vistoria inicial)
CREATE OR REPLACE FUNCTION public.sync_agendamento_base_to_vistoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_associado_id uuid;
  v_veiculo_id uuid;
  v_contrato_id uuid;
  v_vistoria_id uuid;
  v_data_ts timestamptz;
BEGIN
  IF NEW.atendido_por IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.vistoria_id IS NOT NULL THEN
    UPDATE public.vistorias
       SET vistoriador_id = NEW.atendido_por,
           updated_at = now()
     WHERE id = NEW.vistoria_id
       AND (vistoriador_id IS DISTINCT FROM NEW.atendido_por);
    RETURN NEW;
  END IF;

  IF NEW.cotacao_id IS NOT NULL THEN
    SELECT ct.associado_id, ct.veiculo_id, ct.id
      INTO v_associado_id, v_veiculo_id, v_contrato_id
      FROM public.cotacoes c
      LEFT JOIN public.contratos ct ON ct.id = c.contrato_gerado_id
     WHERE c.id = NEW.cotacao_id
     LIMIT 1;

    IF v_veiculo_id IS NULL AND NEW.veiculo_placa IS NOT NULL THEN
      SELECT v.id, v.associado_id
        INTO v_veiculo_id, v_associado_id
        FROM public.veiculos v
       WHERE v.placa = NEW.veiculo_placa
       ORDER BY v.created_at DESC
       LIMIT 1;
    END IF;
  END IF;

  IF v_associado_id IS NULL OR v_veiculo_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_data_ts := (NEW.data_agendada::text || ' ' || COALESCE(NEW.horario::text, '09:00:00'))::timestamptz;

  INSERT INTO public.vistorias (
    associado_id, veiculo_id, contrato_id, cotacao_id, vistoriador_id,
    tipo, status, data_agendada, horario_agendado,
    local_vistoria, modalidade, origem
  ) VALUES (
    v_associado_id, v_veiculo_id, v_contrato_id, NEW.cotacao_id, NEW.atendido_por,
    'entrada'::tipo_vistoria, 'agendada'::status_vistoria, v_data_ts, NEW.horario,
    'base', 'presencial', 'agendamento_base'
  )
  RETURNING id INTO v_vistoria_id;

  UPDATE public.agendamentos_base
     SET vistoria_id = v_vistoria_id
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Backfill agora que o enum está correto
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, atendido_por FROM public.agendamentos_base
     WHERE atendido_por IS NOT NULL AND vistoria_id IS NULL
       AND status IN ('confirmado','agendado','realizado')
  LOOP
    UPDATE public.agendamentos_base
       SET atendido_por = r.atendido_por
     WHERE id = r.id;
  END LOOP;
END $$;
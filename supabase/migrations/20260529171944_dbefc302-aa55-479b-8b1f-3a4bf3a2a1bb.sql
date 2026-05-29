
-- ============================================================
-- Passo 1: Zerar softruck_vehicle_id nos 3 veículos que saíram
-- ============================================================
UPDATE public.veiculos
SET softruck_vehicle_id = NULL,
    updated_at = now()
WHERE placa IN ('LQS2839', 'LUB4C97', 'QQK6G89')
  AND softruck_vehicle_id IN ('ekgzQoqJqlwdAr8', 'PR97L18jKEwnlrm', 'z9klZ7BMxPQ4onE');

-- ============================================================
-- Passo 2a: Zerar softruck_vehicle_id nos 3 veículos que entraram
-- ============================================================
UPDATE public.veiculos
SET softruck_vehicle_id = NULL,
    updated_at = now()
WHERE placa IN ('SWQ4I01', 'RFV2A76', 'LRA9681')
  AND softruck_vehicle_id IN ('ekgzQoqJqlwdAr8', 'PR97L18jKEwnlrm', 'z9klZ7BMxPQ4onE');

-- ============================================================
-- Passo 2b: Zerar plataforma_veiculo_id e marcar rastreadores FAILED_VINCULO
-- ============================================================
UPDATE public.rastreadores
SET plataforma_veiculo_id = NULL,
    softruck_integration_status = 'FAILED_VINCULO',
    softruck_tentativas = 0,
    softruck_response_raw = jsonb_build_object(
      'manual_fix_required', true,
      'motivo', 'softruck_vehicle_id_colisao_saneada_20260529',
      'vehicle_id_anterior', plataforma_veiculo_id,
      'observacao', 'Vehicle inexistente na Softruck (devices flutuando). Necessario criar novo vehicle e refazer vinculo manual igual ao LTC8G02.',
      'sanitized_at', now()
    ),
    updated_at = now()
WHERE imei IN ('862667083422561', '357789645530731', '862667083433089');

-- ============================================================
-- Passo 3a: Trigger guard de unicidade do softruck_vehicle_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_guard_softruck_vehicle_id_unico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflito_id uuid;
  v_conflito_placa text;
BEGIN
  -- NULL é sempre permitido (vários veículos podem estar sem vínculo Softruck)
  IF NEW.softruck_vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, se não mudou o campo, não checa
  IF TG_OP = 'UPDATE'
     AND OLD.softruck_vehicle_id IS NOT DISTINCT FROM NEW.softruck_vehicle_id THEN
    RETURN NEW;
  END IF;

  SELECT id, placa
    INTO v_conflito_id, v_conflito_placa
  FROM public.veiculos
  WHERE softruck_vehicle_id = NEW.softruck_vehicle_id
    AND id <> NEW.id
  LIMIT 1;

  IF v_conflito_id IS NOT NULL THEN
    RAISE EXCEPTION 'softruck_vehicle_id % ja esta vinculado ao veiculo % (placa %). Cada softruck_vehicle_id deve ser unico para evitar loop de re-vinculacao (caso LTC8G02).',
      NEW.softruck_vehicle_id, v_conflito_id, v_conflito_placa
      USING ERRCODE = '23505',
            HINT = 'Zere o softruck_vehicle_id do veiculo conflitante antes de reapontar, ou crie um novo vehicle na Softruck.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_softruck_vehicle_id_unico ON public.veiculos;
CREATE TRIGGER trg_guard_softruck_vehicle_id_unico
BEFORE INSERT OR UPDATE OF softruck_vehicle_id ON public.veiculos
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_softruck_vehicle_id_unico();

-- ============================================================
-- Passo 3b: Índice único parcial como defesa final
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_veiculos_softruck_vehicle_id
ON public.veiculos (softruck_vehicle_id)
WHERE softruck_vehicle_id IS NOT NULL;

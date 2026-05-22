-- Snapshot persistido do tipo de veículo (carro/moto) — decidido pela elegibilidade
-- de linhas de produto no momento da cotação e copiado para o contrato.

ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS tipo_veiculo text,
  ADD COLUMN IF NOT EXISTS tipo_veiculo_motivo text;

ALTER TABLE public.cotacoes
  DROP CONSTRAINT IF EXISTS cotacoes_tipo_veiculo_check;
ALTER TABLE public.cotacoes
  ADD CONSTRAINT cotacoes_tipo_veiculo_check
  CHECK (tipo_veiculo IS NULL OR tipo_veiculo IN ('carro','moto'));

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS tipo_veiculo text;
ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_tipo_veiculo_check;
ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_tipo_veiculo_check
  CHECK (tipo_veiculo IS NULL OR tipo_veiculo IN ('carro','moto'));

-- Guard: ao sair de 'rascunho', cotação precisa ter tipo_veiculo resolvido
CREATE OR REPLACE FUNCTION public.fn_guard_cotacao_exige_tipo_veiculo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT NULL
     AND NEW.status <> 'rascunho'
     AND COALESCE(NEW.tipo_veiculo, '') = ''
  THEN
    -- Não bloquear cotações legadas (criadas antes desta migração)
    -- que já estavam fora de rascunho ANTES. Só bloqueia se está
    -- transitando agora de rascunho → outro estado sem tipo.
    IF TG_OP = 'UPDATE'
       AND OLD.status IS NOT NULL
       AND OLD.status <> 'rascunho'
    THEN
      RETURN NEW; -- legado: estado já avançado, não bloqueia
    END IF;
    RAISE EXCEPTION 'cotacao_sem_tipo_veiculo: status=% requer tipo_veiculo preenchido (carro|moto)', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_cotacao_exige_tipo_veiculo ON public.cotacoes;
CREATE TRIGGER trg_guard_cotacao_exige_tipo_veiculo
  BEFORE INSERT OR UPDATE OF status, tipo_veiculo ON public.cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_cotacao_exige_tipo_veiculo();

-- Guard: contrato novo cuja cotação tem tipo_veiculo deve herdá-lo
CREATE OR REPLACE FUNCTION public.fn_guard_contrato_herda_tipo_veiculo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cot_tipo text;
BEGIN
  IF NEW.cotacao_id IS NOT NULL THEN
    SELECT tipo_veiculo INTO v_cot_tipo
    FROM public.cotacoes
    WHERE id = NEW.cotacao_id;

    IF v_cot_tipo IS NOT NULL AND v_cot_tipo IN ('carro','moto') THEN
      IF NEW.tipo_veiculo IS NULL THEN
        NEW.tipo_veiculo := v_cot_tipo;
      ELSIF NEW.tipo_veiculo <> v_cot_tipo THEN
        RAISE EXCEPTION 'contrato_tipo_veiculo_divergente: contrato=% cotacao=% (deve herdar do snapshot da cotação)',
          NEW.tipo_veiculo, v_cot_tipo
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_contrato_herda_tipo_veiculo ON public.contratos;
CREATE TRIGGER trg_guard_contrato_herda_tipo_veiculo
  BEFORE INSERT OR UPDATE OF tipo_veiculo, cotacao_id ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_contrato_herda_tipo_veiculo();

COMMENT ON COLUMN public.cotacoes.tipo_veiculo IS
  'Snapshot canônico carro|moto derivado da elegibilidade de linhas de produto (product_lines.vehicle_type) no momento da cotação. Congelado ao salvar — consumidores leem daqui, não recomputam.';
COMMENT ON COLUMN public.cotacoes.tipo_veiculo_motivo IS
  'Como o tipo foi resolvido: unanime_moto | unanime_carro | operador_resolveu | legado_heuristica.';
COMMENT ON COLUMN public.contratos.tipo_veiculo IS
  'Herdado da cotacoes.tipo_veiculo via trigger. Imutável após geração — protege documentos e checklists históricos.';
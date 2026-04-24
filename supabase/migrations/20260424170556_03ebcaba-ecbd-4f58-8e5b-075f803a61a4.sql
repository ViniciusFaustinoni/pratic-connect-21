-- Adicionar coluna codigo_sga_plano em planos
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS codigo_sga_plano text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_planos_codigo_sga_plano_unique
  ON public.planos(codigo_sga_plano)
  WHERE codigo_sga_plano IS NOT NULL;

COMMENT ON COLUMN public.planos.codigo_sga_plano IS
  'Código numérico do plano no Hinova SGA (preencher com o código exato do painel do SGA).';

-- Adicionar coluna codigo_sga em benefits
ALTER TABLE public.benefits
  ADD COLUMN IF NOT EXISTS codigo_sga text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_benefits_codigo_sga_unique
  ON public.benefits(codigo_sga)
  WHERE codigo_sga IS NOT NULL;

COMMENT ON COLUMN public.benefits.codigo_sga IS
  'Código do produto/benefício no Hinova SGA (usado em produtos_vinculados ao cadastrar veículo).';

-- Adicionar coluna codigo_sga em coberturas
ALTER TABLE public.coberturas
  ADD COLUMN IF NOT EXISTS codigo_sga text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_coberturas_codigo_sga_unique
  ON public.coberturas(codigo_sga)
  WHERE codigo_sga IS NOT NULL;

COMMENT ON COLUMN public.coberturas.codigo_sga IS
  'Código da cobertura no Hinova SGA (usado em produtos_vinculados ao cadastrar veículo).';

-- ============================================================
-- Trigger: enfileirar atualização da placa no SGA quando o
-- veículo deixa de ser 0KM (placa real cadastrada).
-- ============================================================
CREATE OR REPLACE FUNCTION public.enfileirar_atualizacao_placa_sga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_placeholder boolean;
  v_is_placeholder boolean;
BEGIN
  -- Considera placeholder o padrão técnico 0KM + 5 chars
  v_was_placeholder := COALESCE(OLD.placa, '') ~* '^0KM[A-Z0-9]{5}$';
  v_is_placeholder := COALESCE(NEW.placa, '') ~* '^0KM[A-Z0-9]{5}$';

  IF NEW.placa IS DISTINCT FROM OLD.placa
     AND v_was_placeholder
     AND NOT v_is_placeholder
     AND NEW.codigo_hinova IS NOT NULL THEN

    -- Marca para reprocessamento e enfileira
    NEW.aguardando_placa_definitiva := false;
    NEW.placa_definitiva_atualizada_em := now();

    INSERT INTO public.sga_sync_queue
      (veiculo_id, associado_id, tipo, motivo, created_at, status)
    VALUES
      (NEW.id, NEW.associado_id, 'atualizar_placa',
       'placa_definitiva_emplacamento', now(), 'pendente')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enfileirar_atualizacao_placa_sga ON public.veiculos;
CREATE TRIGGER trg_enfileirar_atualizacao_placa_sga
  BEFORE UPDATE OF placa ON public.veiculos
  FOR EACH ROW
  EXECUTE FUNCTION public.enfileirar_atualizacao_placa_sga();
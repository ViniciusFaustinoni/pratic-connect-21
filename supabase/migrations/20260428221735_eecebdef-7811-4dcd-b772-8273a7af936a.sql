-- =============================================================
-- CORREÇÃO PONTUAL: Veículo Ford Fiesta KOS1G37 (cot. COT-20260428-184559819-363)
-- + PROTEÇÃO ESTRUTURAL: trigger que mantém veiculos.associado_id
--   alinhado com contratos.associado_id ao gerar/atualizar contrato.
-- =============================================================

-- 1) Reapontar veículo do associado fantasma (FAUSTINONI) para o titular
--    correto do contrato (MARCOS DATIVO MACHADO).
UPDATE public.veiculos
   SET associado_id = '20a4f2d5-06d4-4253-bbc4-96f8a67b01d6',
       updated_at   = now()
 WHERE id = 'eac718b4-feb4-47f6-828b-3bb7570f1c38'
   AND associado_id = '14f336a6-4323-4a42-8b6f-49f24dd33ab7';

-- 2) Marcar associado fantasma como recusado (sem contrato/cotação reais).
UPDATE public.associados
   SET status = 'recusado',
       motivo_cancelamento = 'cadastro_duplicado_corrigido_KOS1G37 (vinculo veiculo reapontado p/ DATIVO 20a4f2d5)',
       updated_at = now()
 WHERE id = '14f336a6-4323-4a42-8b6f-49f24dd33ab7'
   AND status = 'pendente_vistoria';

-- 3) Reenfileirar o veículo no SGA sob o codigo_hinova do titular correto.
INSERT INTO public.sga_sync_queue
  (veiculo_id, associado_id, status, tentativas, origem, codigo_associado_hinova)
SELECT
  'eac718b4-feb4-47f6-828b-3bb7570f1c38',
  '20a4f2d5-06d4-4253-bbc4-96f8a67b01d6',
  'pendente',
  0,
  'correcao_manual_KOS1G37',
  '25645'
WHERE NOT EXISTS (
  SELECT 1 FROM public.sga_sync_queue
   WHERE veiculo_id='eac718b4-feb4-47f6-828b-3bb7570f1c38'
     AND status IN ('pendente','processando')
);

-- =============================================================
-- 4) PROTEÇÃO ESTRUTURAL
-- Sempre que um contrato é INSERIDO ou tem veiculo_id/associado_id alterados,
-- garante que veiculos.associado_id == contratos.associado_id.
-- Evita o bug raiz: contrato apontando para um veículo cujo dono é outro.
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_veiculo_associado_from_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF NEW.veiculo_id IS NULL OR NEW.associado_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT associado_id INTO v_owner
    FROM public.veiculos
   WHERE id = NEW.veiculo_id;

  -- Veículo "órfão" ou apontando para outro associado → realinha
  IF v_owner IS DISTINCT FROM NEW.associado_id THEN
    UPDATE public.veiculos
       SET associado_id = NEW.associado_id,
           updated_at   = now()
     WHERE id = NEW.veiculo_id;

    -- Auditoria leve
    RAISE NOTICE 'fn_sync_veiculo_associado_from_contrato: realinhado veiculo % de % para % (contrato %)',
      NEW.veiculo_id, v_owner, NEW.associado_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_veiculo_associado_from_contrato ON public.contratos;
CREATE TRIGGER trg_sync_veiculo_associado_from_contrato
AFTER INSERT OR UPDATE OF veiculo_id, associado_id
ON public.contratos
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_veiculo_associado_from_contrato();

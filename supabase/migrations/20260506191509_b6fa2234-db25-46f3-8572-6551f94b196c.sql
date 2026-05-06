-- Caminho 2 (estrutural): promover contratos legados em 'assinado' para 'ativo'
-- quando associado E veículo já estão 'ativo'. Isso reflete o estado real e
-- limpa a fila de "Propostas Pendentes" no Cadastro.

-- 1) Promoção retroativa (one-shot)
WITH alvos AS (
  SELECT c.id
  FROM public.contratos c
  JOIN public.associados a ON a.id = c.associado_id
  JOIN public.veiculos   v ON v.id = c.veiculo_id
  WHERE c.status = 'assinado'
    AND a.status = 'ativo'
    AND v.status = 'ativo'
)
UPDATE public.contratos c
SET status = 'ativo',
    data_ativacao = COALESCE(c.data_ativacao, now()),
    updated_at = now()
FROM alvos
WHERE c.id = alvos.id;

-- 2) Log de auditoria das promoções retroativas
INSERT INTO public.ativacao_status_log (associado_id, contrato_id, from_status, to_status, source, payload)
SELECT c.associado_id, c.id, 'assinado', 'ativo',
       'migration:sync-contratos-ativos-2026-05-06',
       jsonb_build_object('motivo', 'backfill_status_contrato_apos_ativacao')
FROM public.contratos c
WHERE c.status = 'ativo'
  AND c.data_ativacao >= now() - interval '5 minutes'
  AND NOT EXISTS (
    SELECT 1 FROM public.ativacao_status_log l
    WHERE l.contrato_id = c.id
      AND l.source = 'migration:sync-contratos-ativos-2026-05-06'
  );

-- 3) Trigger guarda-chuva: quando associado E veículo do contrato ficarem 'ativo',
-- promover contrato 'assinado' -> 'ativo' automaticamente.
CREATE OR REPLACE FUNCTION public.fn_sync_contrato_status_apos_ativacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _veic_status text;
  _assoc_status text;
BEGIN
  -- Sincroniza apenas em transições para 'ativo'
  IF TG_TABLE_NAME = 'associados' THEN
    IF NEW.status IS DISTINCT FROM 'ativo' THEN RETURN NEW; END IF;

    UPDATE public.contratos c
    SET status = 'ativo',
        data_ativacao = COALESCE(c.data_ativacao, now()),
        updated_at = now()
    FROM public.veiculos v
    WHERE c.associado_id = NEW.id
      AND c.status = 'assinado'
      AND v.id = c.veiculo_id
      AND v.status = 'ativo';

  ELSIF TG_TABLE_NAME = 'veiculos' THEN
    IF NEW.status IS DISTINCT FROM 'ativo' THEN RETURN NEW; END IF;

    UPDATE public.contratos c
    SET status = 'ativo',
        data_ativacao = COALESCE(c.data_ativacao, now()),
        updated_at = now()
    FROM public.associados a
    WHERE c.veiculo_id = NEW.id
      AND c.status = 'assinado'
      AND a.id = c.associado_id
      AND a.status = 'ativo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contrato_status_assoc ON public.associados;
CREATE TRIGGER trg_sync_contrato_status_assoc
AFTER UPDATE OF status ON public.associados
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ativo')
EXECUTE FUNCTION public.fn_sync_contrato_status_apos_ativacao();

DROP TRIGGER IF EXISTS trg_sync_contrato_status_veic ON public.veiculos;
CREATE TRIGGER trg_sync_contrato_status_veic
AFTER UPDATE OF status ON public.veiculos
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ativo')
EXECUTE FUNCTION public.fn_sync_contrato_status_apos_ativacao();

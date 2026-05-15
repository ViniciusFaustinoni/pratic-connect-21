-- Proteção: vistoria nunca pode ficar órfã sem contrato/cotação/associado
-- enquanto o veículo já estiver vinculado a um contrato ativo. Isso bloqueia
-- o "limbo" que tirou MARCUS VINICIUS FAUSTINONI da fila Aprovação de Associados.

CREATE OR REPLACE FUNCTION public.fn_vistorias_autopreencher_vinculos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contrato_id   uuid;
  v_cotacao_id    uuid;
  v_associado_id  uuid;
BEGIN
  -- Só age quando faltam vínculos e temos pelo menos veículo OU instalação
  IF NEW.contrato_id IS NOT NULL
     AND NEW.cotacao_id IS NOT NULL
     AND NEW.associado_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Tentar via instalacao_id (mais específico)
  IF NEW.instalacao_id IS NOT NULL THEN
    SELECT i.contrato_id, i.cotacao_id, i.associado_id
      INTO v_contrato_id, v_cotacao_id, v_associado_id
      FROM public.instalacoes i
     WHERE i.id = NEW.instalacao_id;
  END IF;

  -- 2) Tentar via veiculo_id → contrato ativo mais recente do veículo
  IF (v_contrato_id IS NULL AND NEW.contrato_id IS NULL) AND NEW.veiculo_id IS NOT NULL THEN
    SELECT c.id, c.cotacao_id, c.associado_id
      INTO v_contrato_id, v_cotacao_id, v_associado_id
      FROM public.contratos c
     WHERE c.veiculo_id = NEW.veiculo_id
       AND c.status NOT IN ('cancelado')
     ORDER BY c.created_at DESC
     LIMIT 1;
  END IF;

  -- 3) Tentar via cotacao_id já presente
  IF (v_contrato_id IS NULL AND NEW.contrato_id IS NULL) AND NEW.cotacao_id IS NOT NULL THEN
    SELECT c.id, c.associado_id
      INTO v_contrato_id, v_associado_id
      FROM public.contratos c
     WHERE c.cotacao_id = NEW.cotacao_id
       AND c.status NOT IN ('cancelado')
     ORDER BY c.created_at DESC
     LIMIT 1;
  END IF;

  -- Aplica apenas o que estava NULL (não sobrescreve dado deliberado)
  IF NEW.contrato_id  IS NULL AND v_contrato_id  IS NOT NULL THEN NEW.contrato_id  := v_contrato_id;  END IF;
  IF NEW.cotacao_id   IS NULL AND v_cotacao_id   IS NOT NULL THEN NEW.cotacao_id   := v_cotacao_id;   END IF;
  IF NEW.associado_id IS NULL AND v_associado_id IS NOT NULL THEN NEW.associado_id := v_associado_id; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vistorias_autopreencher_vinculos ON public.vistorias;
CREATE TRIGGER trg_vistorias_autopreencher_vinculos
BEFORE INSERT OR UPDATE OF veiculo_id, instalacao_id, cotacao_id, contrato_id, associado_id
ON public.vistorias
FOR EACH ROW
EXECUTE FUNCTION public.fn_vistorias_autopreencher_vinculos();

-- Reconciliação retroativa: corrige qualquer outra vistoria já órfã
UPDATE public.vistorias v
   SET contrato_id  = COALESCE(v.contrato_id,  c.id),
       cotacao_id   = COALESCE(v.cotacao_id,   c.cotacao_id),
       associado_id = COALESCE(v.associado_id, c.associado_id),
       updated_at   = now()
  FROM public.contratos c
 WHERE c.veiculo_id = v.veiculo_id
   AND c.status NOT IN ('cancelado')
   AND (v.contrato_id IS NULL OR v.cotacao_id IS NULL OR v.associado_id IS NULL)
   AND v.veiculo_id IS NOT NULL
   AND c.id = (
     SELECT c2.id FROM public.contratos c2
      WHERE c2.veiculo_id = v.veiculo_id
        AND c2.status NOT IN ('cancelado')
      ORDER BY c2.created_at DESC LIMIT 1
   );
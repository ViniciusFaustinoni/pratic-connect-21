-- Função: promove associado de documentacao_pendente -> em_analise
-- quando não há mais documentos aguardando análise.
CREATE OR REPLACE FUNCTION public.fn_promover_associado_pos_docs_aprovados()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_associado_id uuid;
  v_pend_contrato int;
  v_pend_solicitados int;
BEGIN
  -- Descobrir o associado afetado conforme tabela
  IF TG_TABLE_NAME = 'contratos_documentos' THEN
    SELECT c.associado_id INTO v_associado_id
    FROM contratos c
    WHERE c.cotacao_id = NEW.cotacao_id
    LIMIT 1;
  ELSIF TG_TABLE_NAME = 'documentos_solicitados' THEN
    v_associado_id := NEW.associado_id;
  END IF;

  IF v_associado_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Só age se associado está preso em documentacao_pendente
  PERFORM 1 FROM associados
   WHERE id = v_associado_id AND status = 'documentacao_pendente';
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Existe algum documento de contrato ainda aguardando análise?
  SELECT COUNT(*) INTO v_pend_contrato
  FROM contratos_documentos cd
  JOIN contratos c ON c.cotacao_id = cd.cotacao_id
  WHERE c.associado_id = v_associado_id
    AND cd.status IN ('em_analise','enviado','pendente');

  -- Existe algum documento solicitado ainda aguardando?
  SELECT COUNT(*) INTO v_pend_solicitados
  FROM documentos_solicitados ds
  WHERE ds.associado_id = v_associado_id
    AND ds.status IN ('pendente','enviado');

  IF v_pend_contrato = 0 AND v_pend_solicitados = 0 THEN
    UPDATE associados
       SET status = 'em_analise', updated_at = now()
     WHERE id = v_associado_id
       AND status = 'documentacao_pendente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promover_assoc_pos_doc_contrato ON contratos_documentos;
CREATE TRIGGER trg_promover_assoc_pos_doc_contrato
AFTER INSERT OR UPDATE OF status ON contratos_documentos
FOR EACH ROW
WHEN (NEW.status = 'aprovado')
EXECUTE FUNCTION public.fn_promover_associado_pos_docs_aprovados();

DROP TRIGGER IF EXISTS trg_promover_assoc_pos_doc_solicitado ON documentos_solicitados;
CREATE TRIGGER trg_promover_assoc_pos_doc_solicitado
AFTER INSERT OR UPDATE OF status ON documentos_solicitados
FOR EACH ROW
WHEN (NEW.status = 'aprovado')
EXECUTE FUNCTION public.fn_promover_associado_pos_docs_aprovados();

-- Backfill: promove associados com tudo aprovado mas presos em documentacao_pendente
UPDATE associados a
SET status = 'em_analise', updated_at = now()
WHERE a.status = 'documentacao_pendente'
  AND NOT EXISTS (
    SELECT 1 FROM contratos c
    JOIN contratos_documentos cd ON cd.cotacao_id = c.cotacao_id
    WHERE c.associado_id = a.id
      AND cd.status IN ('em_analise','enviado','pendente')
  )
  AND NOT EXISTS (
    SELECT 1 FROM documentos_solicitados ds
    WHERE ds.associado_id = a.id
      AND ds.status IN ('pendente','enviado')
  )
  AND EXISTS (
    SELECT 1 FROM contratos c
    JOIN contratos_documentos cd ON cd.cotacao_id = c.cotacao_id
    WHERE c.associado_id = a.id
      AND cd.status = 'aprovado'
  );
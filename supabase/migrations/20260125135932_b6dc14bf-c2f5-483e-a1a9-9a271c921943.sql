-- Atualizar trigger para também sincronizar rastreador_id
CREATE OR REPLACE FUNCTION sync_servico_to_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Só propagar quando status muda para concluida
  IF NEW.tipo = 'instalacao' AND NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE instalacoes
    SET 
      status = 'concluida',
      concluida_em = COALESCE(NEW.concluida_em, NOW()),
      instalador_responsavel_id = COALESCE(NEW.profissional_id, instalador_responsavel_id),
      rastreador_id = COALESCE(NEW.rastreador_id, rastreador_id),
      updated_at = NOW()
    WHERE contrato_id = NEW.contrato_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Sincronizar rastreador_id para serviços já concluídos que não têm rastreador em instalacoes
UPDATE instalacoes i
SET rastreador_id = s.rastreador_id,
    updated_at = NOW()
FROM servicos s
WHERE s.contrato_id = i.contrato_id
  AND s.status = 'concluida'
  AND s.rastreador_id IS NOT NULL
  AND i.rastreador_id IS NULL;